import asyncio
import base64
from email.message import EmailMessage
from datetime import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.db.mongo import get_db
from app.core.config import settings

async def _get_gmail_service(company_id: int):
    db = await get_db()
    doc = await db['gmail_connections'].find_one({'companyId': company_id})
    if not doc:
        return None, None, False, None

    if doc.get('useSmtp'):
        return None, doc.get('email'), True, doc.get('smtpPassword')

    if not doc.get('accessToken'):
        return None, None, False, None

    creds = Credentials(
        token=doc['accessToken'],
        refresh_token=doc.get('refreshToken'),
        client_id=settings.gmail_client_id,
        client_secret=settings.gmail_client_secret,
        token_uri="https://oauth2.googleapis.com/token"
    )
    
    # We run the build in a thread to prevent blocking
    service = await asyncio.to_thread(build, 'gmail', 'v1', credentials=creds)
    return service, doc.get('email'), False, None

async def send_lead_alert(company_id: int, ticket_payload: dict, company_email: str, customer_email: str = None):
    """
    Sends an email alert to the company when a lead is qualified or a complaint is filed.
    """
    service, sender_email, use_smtp, smtp_password = await _get_gmail_service(company_id)
    if not service and not use_smtp:
        print(f"[Email Service] No Gmail integration found for company {company_id}. Skipping lead alert.")
        return

    category = ticket_payload.get('category', 'lead')
    summary = ticket_payload.get('summary', '')
    customer_message = ticket_payload.get('customer_message', '')
    
    if category == 'complaint':
        subject = "🚨 Action Required: New Customer Complaint"
        title = "New Customer Complaint"
        color = "#e53e3e"
    else:
        subject = "🎉 New Qualified Lead: Action Required"
        title = "New Qualified Lead"
        color = "#3182ce"
        
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: {color}; border-bottom: 2px solid {color}; padding-bottom: 10px;">{title}</h2>
                <p><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
                <p><strong>Summary:</strong></p>
                <div style="background-color: #f7fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    {summary}
                </div>
                <p><strong>Latest Message from Customer:</strong></p>
                <blockquote style="border-left: 4px solid #cbd5e0; margin-left: 0; padding-left: 15px; font-style: italic;">
                    {customer_message}
                </blockquote>
                <p style="margin-top: 30px; font-size: 14px; color: #718096;">
                    You can reply directly to this email to respond to the customer, or log in to your Closira Dashboard.
                </p>
            </div>
        </body>
    </html>
    """
    
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = sender_email
    msg['To'] = company_email
    if customer_email:
        msg['Reply-To'] = customer_email
    msg.set_content("Please enable HTML to view this message.")
    msg.add_alternative(html_body, subtype='html')

    def _send_smtp():
        import smtplib
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, smtp_password)
            server.send_message(msg)

    def _send_oauth():
        raw_msg = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId='me', body={'raw': raw_msg}).execute()
        
    try:
        if use_smtp:
            await asyncio.to_thread(_send_smtp)
        else:
            await asyncio.to_thread(_send_oauth)
        print(f"Lead alert sent successfully to {company_email}")
    except Exception as e:
        print(f"Failed to send lead alert via Email API/SMTP: {e}")

async def send_customer_reply(company_id: int, subject: str, ai_response: str, customer_email: str):
    """
    Sends a natural text reply back to the customer using the company's connected Gmail.
    """
    service, sender_email, use_smtp, smtp_password = await _get_gmail_service(company_id)
    if not service and not use_smtp:
        print(f"[Email Service] No Gmail integration found for company {company_id}. Skipping customer reply.")
        return

    if not subject.startswith("Re:"):
        subject = f"Re: {subject}"
        
    subject = " ".join(subject.split())
        
    # Safety strip just in case the LLM ignored instructions and included Subject/To lines
    lines = ai_response.strip().split("\n")
    cleaned_lines = []
    for line in lines:
        if line.lower().startswith("subject:") or line.lower().startswith("to:"):
            continue
        cleaned_lines.append(line)
        
    ai_response = "\n".join(cleaned_lines).strip()
        
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = sender_email
    msg['To'] = customer_email
    msg.set_content(ai_response)

    def _send_smtp():
        import smtplib
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, smtp_password)
            server.send_message(msg)

    def _send_oauth():
        raw_msg = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId='me', body={'raw': raw_msg}).execute()
        
    try:
        if use_smtp:
            await asyncio.to_thread(_send_smtp)
        else:
            await asyncio.to_thread(_send_oauth)
        print(f"Customer reply sent successfully to {customer_email}")
    except Exception as e:
        print(f"Failed to send customer reply via Email API/SMTP: {e}")

