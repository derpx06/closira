import asyncio
import base64
import re
import imaplib
import email
from email.header import decode_header
from bs4 import BeautifulSoup
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.db.mongo import get_db
from app.core.config import settings

def _parse_gmail_api_body(payload):
    if 'data' in payload.get('body', {}):
        data = payload['body']['data']
        return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4)).decode('utf-8', errors='ignore')
    
    parts = payload.get('parts', [])
    text_content = ""
    html_content = ""
    
    def extract_parts(parts):
        nonlocal text_content, html_content
        for p in parts:
            if p['mimeType'] == 'text/plain':
                data = p['body'].get('data', '')
                text_content += base64.urlsafe_b64decode(data + '=' * (-len(data) % 4)).decode('utf-8', errors='ignore')
            elif p['mimeType'] == 'text/html':
                data = p['body'].get('data', '')
                html_content += base64.urlsafe_b64decode(data + '=' * (-len(data) % 4)).decode('utf-8', errors='ignore')
            elif 'parts' in p:
                extract_parts(p['parts'])
                
    extract_parts(parts)
    
    if text_content.strip():
        body = text_content
    elif html_content.strip():
        soup = BeautifulSoup(html_content, "lxml")
        body = soup.get_text(separator="\n", strip=True)
    else:
        body = ""
        
    body = re.split(r'(?i)\r?\nOn\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+.*?\s+wrote:\r?\n', body)[0]
    body = re.split(r'(?i)\r?\n_{10,}\r?\n', body)[0]
    body = re.split(r'(?i)\r?\n>.*', body)[0]
    
    return body.strip()

def _check_inbox_sync_imap(username, password):
    print(f"[IMAP] Connecting for {username}...")
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(username, password)
        mail.select("inbox")

        # Use X-GM-RAW to safely search for breakout in gmail IMAP
        status, messages = mail.search(None, 'X-GM-RAW', '"is:unread in:inbox breakout"')
        unread_emails = []
        
        if status == "OK":
            email_ids = messages[0].split()
            # To prevent API limit exhaustion, process max 5 emails at a time
            email_ids = email_ids[-5:]
            print(f"[IMAP] Found {len(email_ids)} unseen emails to process in this batch.")
            for e_id in email_ids:
                res, msg_data = mail.fetch(e_id, "(BODY.PEEK[])")
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        
                        subject, encoding = decode_header(msg["Subject"])[0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")
                            
                        sender = msg.get("From")
                        sender_email = sender.split("<")[-1].strip(">") if "<" in sender else sender
                        sender_name = sender.split("<")[0].strip() if "<" in sender else "Email User"
                        
                        # We can use the same body parser or fallback to standard
                        text_content = ""
                        html_content = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    text_content += part.get_payload(decode=True).decode(errors='ignore')
                                elif part.get_content_type() == "text/html":
                                    html_content += part.get_payload(decode=True).decode(errors='ignore')
                        else:
                            if msg.get_content_type() == "text/plain":
                                text_content = msg.get_payload(decode=True).decode(errors='ignore')
                            elif msg.get_content_type() == "text/html":
                                html_content = msg.get_payload(decode=True).decode(errors='ignore')
                                
                        if text_content.strip():
                            body = text_content
                        elif html_content.strip():
                            soup = BeautifulSoup(html_content, "lxml")
                            body = soup.get_text(separator="\n", strip=True)
                        else:
                            body = ""
                            
                        body = re.split(r'(?i)\r?\nOn\s+(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+.*?\s+wrote:\r?\n', body)[0]
                        body = re.split(r'(?i)\r?\n_{10,}\r?\n', body)[0]
                        body = re.split(r'(?i)\r?\n>.*', body)[0]
                        
                        subject_clean = " ".join(subject.split())
                        
                        unread_emails.append({
                            "id": e_id,
                            "subject": subject_clean,
                            "sender_email": sender_email,
                            "sender_name": sender_name,
                            "body": body.strip()[:4000] # Truncate to prevent token limit errors
                        })
        mail.logout()
        return unread_emails
    except Exception as e:
        print(f"[IMAP] Error: {e}")
        return []

def _mark_seen_sync_imap(username, password, e_id):
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(username, password)
    mail.select("inbox")
    mail.store(e_id, '+FLAGS', '\\Seen')
    mail.logout()

def _check_inbox_sync(service):
    results = service.users().messages().list(userId='me', q='is:unread in:inbox breakout').execute()
    messages = results.get('messages', [])
    
    unread_emails = []
    for msg_meta in messages:
        msg = service.users().messages().get(userId='me', id=msg_meta['id'], format='full').execute()
        
        headers = msg['payload'].get('headers', [])
        subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
        sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown')
        
        sender_email = sender.split("<")[-1].strip(">") if "<" in sender else sender
        sender_name = sender.split("<")[0].strip() if "<" in sender else "Email User"
        
        body = _parse_gmail_api_body(msg['payload'])
        
        subject_clean = " ".join(subject.split()) if subject else "No Subject"
        
        unread_emails.append({
            "id": msg_meta['id'],
            "subject": subject_clean,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "body": body[:4000] # Truncate to prevent token limit errors
        })
    return unread_emails

def _mark_seen_sync(service, e_id):
    service.users().messages().modify(userId='me', id=e_id, body={'removeLabelIds': ['UNREAD']}).execute()

async def poll_emails():
    print("Starting Multi-Tenant Email Agent polling...")
    
    while True:
        try:
            db = await get_db()
            connections = await db['gmail_connections'].find().to_list(None)
            
            for conn in connections:
                use_smtp = conn.get('useSmtp', False)
                if not use_smtp and not conn.get('accessToken'):
                    continue
                    
                company_id = conn['companyId']
                email_address = conn.get('email', 'Unknown')
                
                try:
                    if use_smtp:
                        unread_emails = await asyncio.to_thread(_check_inbox_sync_imap, email_address, conn.get('smtpPassword'))
                        service = None
                    else:
                        creds = Credentials(
                            token=conn['accessToken'],
                            refresh_token=conn.get('refreshToken'),
                            client_id=settings.gmail_client_id,
                            client_secret=settings.gmail_client_secret,
                            token_uri="https://oauth2.googleapis.com/token"
                        )
                        service = await asyncio.to_thread(build, 'gmail', 'v1', credentials=creds)
                        unread_emails = await asyncio.to_thread(_check_inbox_sync, service)
                    
                    for email_data in unread_emails:
                        print(f"📩 Processing Email from {email_data['sender_email']} to {email_address} (Company {company_id})")
                        
                        # Find primary website for this company so RAG knows which collection to search
                        site = await db['knowledge_sites'].find_one({'companyId': company_id})
                        website_id = site.get('id') if site else None
                        
                        payload = {
                            "query": f"Subject: {email_data['subject']}\n\n{email_data['body']}",
                            "sessionId": email_data['sender_email'],
                            "customerName": email_data['sender_name'],
                            "websiteId": website_id
                        }
                        
                        from app.services.rag_service import rag_chat
                        status_code, result = await rag_chat(
                            body=payload, 
                            authorization=None, 
                            x_api_key=None, 
                            internal_company_id=company_id
                        )
                        
                        if status_code == 200 and isinstance(result, dict):
                            ai_answer = result.get("answer", "I am having trouble connecting to my brain.")
                            print(f"✅ AI Answer generated for {email_data['sender_email']}: {ai_answer[:50]}...")
                            
                            from app.services.email_service import send_customer_reply
                            await send_customer_reply(company_id, email_data['subject'], ai_answer, email_data['sender_email'])
                            
                            if use_smtp:
                                await asyncio.to_thread(_mark_seen_sync_imap, email_address, conn.get('smtpPassword'), email_data['id'])
                            else:
                                await asyncio.to_thread(_mark_seen_sync, service, email_data['id'])
                        else:
                            print(f"❌ Failed to process email via native pipeline: {result}")
                            
                except Exception as e:
                    print(f"Error processing emails for Company {company_id}: {e}")
                    
        except Exception as e:
            print(f"Email Agent main loop error: {e}")
            
        await asyncio.sleep(15)

if __name__ == "__main__":
    asyncio.run(poll_emails())
