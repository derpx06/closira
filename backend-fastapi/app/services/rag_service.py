from __future__ import annotations

import hashlib
from datetime import datetime
from urllib.parse import urlparse
from app.db.mongo import get_db
from app.db.counters import next_sequence
from app.db.qdrant import get_knowledge_collection_name, qdrant
from app.services.lead_graph import lead_graph_app
from app.services.ticket_vector_service import ticket_vector_service
from app.utils.role_assignment import resolve_assigned_role
from app.utils.sentiment import infer_sentiment
from app.crawler.sitemap import fetch_sitemap_urls
from app.crawler.map_next_routes import create_route_map, summarize_route_map, route_map_to_sitemap_pages


def normalize_base_url(input_url: str | None) -> str:
    if not input_url:
        return ''
    try:
        p = urlparse(input_url)
        return f'{p.scheme}://{p.netloc}' if p.scheme and p.netloc else ''
    except Exception:
        return ''


import time

_company_cache: dict[str, tuple[int, tuple, float]] = {}
CACHE_TTL = 300  # 5 minutes

async def resolve_chat_company(authorization: str | None, x_api_key: str | None):
    from app.auth.jwt import verify_token
    
    cache_key = f"api:{x_api_key}" if x_api_key else f"auth:{authorization}"
    if cache_key in _company_cache:
        val, expiry = _company_cache[cache_key]
        if time.time() < expiry:
            return val
            
    if x_api_key and x_api_key.strip():
        db = await get_db()
        key_doc = await db['api_keys'].find_one({'key': x_api_key.strip(), 'isActive': True})
        if not key_doc:
            return None, None, True, 'Invalid or inactive API Key'
        res = (int(key_doc['companyId']), key_doc.get('websiteId'), True, None)
        _company_cache[cache_key] = (res, time.time() + CACHE_TTL)
        return res

    if authorization and authorization.startswith('Bearer '):
        try:
            payload = verify_token(authorization[7:])
            res = (int(payload.get('companyId')), None, False, None)
            _company_cache[cache_key] = (res, time.time() + CACHE_TTL)
            return res
        except Exception:
            return None, None, False, 'Invalid or expired session.'

    return None, None, False, 'Authentication required.'


async def rag_chat(body: dict, authorization: str | None, x_api_key: str | None, internal_company_id: int | None = None):
    if internal_company_id is not None:
        company_id = internal_company_id
        website_id_from_key = None
        from_api_key = True
        err = None
    else:
        company_id, website_id_from_key, from_api_key, err = await resolve_chat_company(authorization, x_api_key)
        
    if err:
        return 401, {'error': err}

    query = body.get('query')
    session_id = body.get('sessionId')
    requested_website_id = body.get('websiteId')
    normalized_requested_website_id = None
    if requested_website_id not in (None, '', 'null'):
        try:
            normalized_requested_website_id = int(requested_website_id)
        except (TypeError, ValueError):
            normalized_requested_website_id = None

    normalized_key_website_id = None
    if website_id_from_key not in (None, '', 'null'):
        try:
            normalized_key_website_id = int(website_id_from_key)
        except (TypeError, ValueError):
            normalized_key_website_id = None

    if normalized_key_website_id is not None:
        website_id = normalized_key_website_id
    else:
        website_id = normalized_requested_website_id

    chat_history = []
    if session_id and session_id != 'default':
        try:
            db = await get_db()
            existing_ticket = await db['tickets'].find_one({
                'sessionId': session_id,
                'companyId': company_id
            })
            if existing_ticket:
                past_messages = await db['messages'].find(
                    {'ticketId': existing_ticket['_id']}
                ).sort('createdAt', -1).limit(6).to_list(length=6)
                
                # Reverse to chronological order and exclude the current message if it's already there (it shouldn't be yet)
                past_messages.reverse()
                for msg in past_messages:
                    chat_history.append({
                        'role': 'user' if msg.get('sender') == 'user' else 'assistant',
                        'content': msg.get('text', '')
                    })
        except Exception as e:
            print("Error fetching chat history:", e)
            
        if not chat_history and (session_id.startswith('whatsapp:') or '@' in session_id):
            try:
                db = await get_db()
                collection = 'whatsapp_sessions' if session_id.startswith('whatsapp:') else 'email_sessions'
                session_doc = await db[collection].find_one({'sessionId': session_id, 'companyId': company_id})
                if session_doc:
                    chat_history = session_doc.get('history', [])
            except Exception as e:
                pass

    # Determine channel from sessionId
    channel = 'web'
    if session_id:
        if session_id.startswith('whatsapp:'):
            channel = 'whatsapp'
        elif '@' in session_id:
            channel = 'email'

    state_input = {
        "query": query,
        "session_id": session_id or "default",
        "company_id": company_id,
        "website_id": website_id,
        "chat_history": chat_history,
        "channel": channel
    }
    
    # Run the state machine
    config = {"configurable": {"thread_id": session_id or "default"}}
    result_state = await lead_graph_app.ainvoke(state_input, config)
    
    result = {
        'answer': result_state.get('answer'),
        'needs_handoff': result_state.get('needs_handoff', False),
        'raise_ticket': result_state.get('raise_ticket', False),
        'ticket_payload': result_state.get('ticket_payload'),
        'confidence': result_state.get('confidence', 1.0)
    }

    if result.get('raise_ticket') and result.get('ticket_payload'):
        try:
            db = await get_db()
            now = datetime.utcnow()
            payload = result['ticket_payload']
            assigned_role = await resolve_assigned_role(company_id, payload.get('category') or 'other', payload.get('customer_message') or query)
            sentiment_label = result_state.get('sentiment_label', 'neutral')
            sentiment_emoji = result_state.get('sentiment_emoji', '😐')
            
            # Fetch company admin email for alerts
            company_doc = await db['companies'].find_one({'_id': company_id})
            company_email = company_doc.get('email') if company_doc else None
            # If no company email, fallback to SMTP_EMAIL or a generic admin
            if not company_email:
                import os
                company_email = os.getenv('SMTP_EMAIL', 'admin@closira.com')
            
            customer_email = session_id if '@' in (session_id or '') else None

            existing_ticket = None
            if session_id and session_id != 'default':
                # Find an existing pending or assigned ticket for this session to append to
                existing_ticket = await db['tickets'].find_one({
                    'sessionId': session_id, 
                    'companyId': company_id,
                    'status': {'$in': ['pending', 'assigned']}
                })
            
            if existing_ticket:
                ticket_id = existing_ticket['_id']
                await db['messages'].insert_one({
                    'ticketId': ticket_id,
                    'companyId': company_id,
                    'sender': 'user',
                    'text': payload.get('customer_message') or query,
                    'createdAt': now,
                    'updatedAt': now,
                })
                # Update the ticket summary if it's a new qualification step
                if payload.get('summary') and 'Lead (Qualifying)' in payload.get('summary', ''):
                    await db['tickets'].update_one(
                        {'_id': ticket_id}, 
                        {'$set': {'message': payload.get('summary'), 'updatedAt': now}}
                    )
                result['ticket'] = {'_id': ticket_id, **existing_ticket}
            else:
                ticket_doc = {
                    'companyId': company_id,
                    'sessionId': session_id,
                    'message': payload.get('summary') or query,
                    'category': payload.get('category') or 'other',
                    'priority': payload.get('priority') or 'medium',
                    'urgency': payload.get('urgency') or payload.get('priority') or 'medium',
                    'status': 'pending',
                    'assignedTo': None,
                    'assignedRoleId': assigned_role.get('id') if assigned_role else None,
                    'assignedRoleName': assigned_role.get('name') if assigned_role else None,
                    'sentiment': sentiment_label,
                    'sentimentEmoji': sentiment_emoji,
                    'customerName': (str(body.get('customerName') or 'AI Chat User').strip() or 'AI Chat User'),
                    'source': 'ai',
                    'createdAt': now,
                    'updatedAt': now,
                }
                inserted = await db['tickets'].insert_one(ticket_doc)
                ticket_id = inserted.inserted_id
                await db['messages'].insert_one({
                    'ticketId': ticket_id,
                    'companyId': company_id,
                    'sender': 'user',
                    'text': payload.get('customer_message') or query,
                    'createdAt': now,
                    'updatedAt': now,
                })
                result['ticket'] = {'_id': ticket_id, **ticket_doc}

                try:
                    await ticket_vector_service.upsert_ticket({
                        'ticketId': str(ticket_id),
                        'companyId': company_id,
                        'message': payload.get('customer_message') or query,
                        'category': ticket_doc['category'],
                        'priority': ticket_doc['priority'],
                        'customerName': ticket_doc['customerName'],
                    })
                    await db['tickets'].update_one({'_id': ticket_id}, {'$set': {'vectorizedAt': datetime.utcnow()}})
                except Exception:
                    pass
                
            # Trigger Escalation Email Alert
            if company_email:
                from app.services.email_service import send_lead_alert
                import asyncio
                
                # Combine payload with existing ticket if any to pass to the email service
                alert_payload = {
                    'category': payload.get('category') or (existing_ticket.get('category') if existing_ticket else 'other'),
                    'priority': payload.get('priority') or (existing_ticket.get('priority') if existing_ticket else 'medium'),
                    'sentiment': sentiment_label,
                    'sentimentEmoji': sentiment_emoji,
                    'customerName': body.get('customerName') or 'AI Chat User',
                    'summary': payload.get('summary') or query,
                    'message': payload.get('customer_message') or query
                }
                
                asyncio.create_task(send_lead_alert(company_id, alert_payload, company_email, customer_email))
                
                
        except Exception as e:
            print(f"Ticket Escalation Error: {e}")
            
    # Save stateless history if no ticket was raised (WhatsApp or Email)
    if session_id and not result.get('raise_ticket'):
        if session_id.startswith('whatsapp:') or '@' in session_id:
            try:
                db = await get_db()
                collection = 'whatsapp_sessions' if session_id.startswith('whatsapp:') else 'email_sessions'
                
                new_history = chat_history + [
                    {'role': 'user', 'content': query},
                    {'role': 'assistant', 'content': result.get('answer', '')}
                ]
                # Keep rolling window of last 6 messages (3 interactions)
                if len(new_history) > 6:
                    new_history = new_history[-6:]
                    
                await db[collection].update_one(
                    {'sessionId': session_id, 'companyId': company_id},
                    {
                        '$set': {
                            'history': new_history,
                            'websiteId': website_id,
                            'updatedAt': __import__('datetime').datetime.utcnow()
                        },
                        '$setOnInsert': {
                            'createdAt': __import__('datetime').datetime.utcnow()
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                print(f"Failed to update stateless session history: {e}")

    return 200, result


async def knowledge_base_stats(company_id: int):
    db = await get_db()
    sites = await db['knowledge_sites'].find({'companyId': company_id}).to_list(length=None)
    sitemap_docs = await db['sitemaps'].find({'companyId': company_id}).to_list(length=None)
    grounded_docs = await db['grounded_objects'].find({'companyId': company_id}).to_list(length=None)

    async def fetch_vector_count(cid: int, website_id=None):
        collection_name = get_knowledge_collection_name(cid, website_id)
        try:
            info = await qdrant.get_collection(collection_name)
            return int(getattr(info, 'points_count', 0) or 0)
        except Exception:
            return 0

    site_payloads = []
    for site in sites:
        site_sitemap = next((doc for doc in sitemap_docs if doc.get('websiteId') == site.get('id')), None)
        pages = site_sitemap.get('pages', []) if site_sitemap else []
        vector_count = await fetch_vector_count(company_id, site.get('id'))
        site_payloads.append({
            'id': site.get('id'),
            'label': site.get('label'),
            'baseUrl': site.get('baseUrl'),
            'description': site.get('description') or '',
            'instructions': site.get('instructions') or '',
            'totalPages': len(pages),
            'pages': pages,
            'vectorCount': vector_count,
            'groundedFactsCount': sum(1 for g in grounded_docs if g.get('websiteId') == site.get('id')),
        })

    return {
        'vectorCount': sum(int(s.get('vectorCount') or 0) for s in site_payloads),
        'sites': site_payloads,
    }


async def create_knowledge_site(company_id: int, label: str, base_url: str):
    db = await get_db()
    normalized = normalize_base_url(base_url)
    if not normalized:
        return 400, {'error': 'Invalid website URL.'}

    existing = await db['knowledge_sites'].find_one({'companyId': company_id, 'baseUrl': normalized})
    if existing:
        if existing.get('label') != label:
            await db['knowledge_sites'].update_one({'companyId': company_id, 'id': existing['id']}, {'$set': {'label': label, 'updatedAt': datetime.utcnow()}})
        existing['label'] = label
        return 200, {'data': existing}

    doc = {
        'id': await next_sequence('knowledge_sites'),
        'companyId': company_id,
        'baseUrl': normalized,
        'label': label,
        'description': '',
        'instructions': '',
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }
    await db['knowledge_sites'].insert_one(doc)
    return 201, {'data': doc}


async def delete_knowledge_site(company_id: int, website_id: int):
    db = await get_db()
    site = await db['knowledge_sites'].find_one({'companyId': company_id, 'id': website_id})
    if not site:
        return 404, {'error': 'Website not found.'}
    
    # 1. Drop vector collection
    collection_name = get_knowledge_collection_name(company_id, website_id)
    try:
        await qdrant.delete_collection(collection_name=collection_name)
    except Exception:
        pass

    # 2. Delete DB records
    await db['sitemaps'].delete_many({'companyId': company_id, 'websiteId': website_id})
    await db['grounded_objects'].delete_many({'companyId': company_id, 'websiteId': website_id})
    await db['knowledge_sites'].delete_one({'companyId': company_id, 'id': website_id})

    return 200, {'ok': True, 'message': 'Knowledge site deleted successfully.'}


async def list_api_keys(company_id: int):
    db = await get_db()
    return await db['api_keys'].find({'companyId': company_id}).to_list(length=None)


async def create_api_key(company_id: int, label: str | None, website_id: int | None):
    db = await get_db()
    if website_id is not None:
        site = await db['knowledge_sites'].find_one({'id': int(website_id), 'companyId': company_id})
        if not site:
            return 400, {'error': 'Invalid website selection.'}

    key = hashlib.sha256(f'{datetime.utcnow().isoformat()}-{company_id}'.encode()).hexdigest()
    doc = {
        'id': await next_sequence('api_keys'),
        'companyId': company_id,
        'key': key,
        'label': label or 'New API Key',
        'websiteId': website_id,
        'isActive': True,
        'createdAt': datetime.utcnow(),
    }
    await db['api_keys'].insert_one(doc)
    return 201, doc


async def delete_api_key(company_id: int, key_id: int):
    db = await get_db()
    await db['api_keys'].delete_one({'id': key_id, 'companyId': company_id})
    return {'message': 'API key revoked'}


async def delete_knowledge_base(company_id: int, website_id: int | None):
    from app.services.indexer_service import indexer_service
    await indexer_service.delete_all({'companyId': company_id, 'websiteId': website_id})
    db = await get_db()
    await db['grounded_objects'].delete_many({'companyId': company_id, 'websiteId': website_id})
    return {'message': 'Knowledge base fully cleared.'}


async def update_knowledge_site_profile(company_id: int, website_id: int, description: str, instructions: str):
    db = await get_db()
    site = await db['knowledge_sites'].find_one({'companyId': company_id, 'id': website_id})
    if not site:
        return 404, {'error': 'Website not found.'}
    await db['knowledge_sites'].update_one(
        {'companyId': company_id, 'id': website_id},
        {'$set': {
            'description': description.strip(),
            'instructions': instructions.strip(),
            'updatedAt': datetime.utcnow(),
        }},
    )
    return 200, {'ok': True}


async def list_grounded_objects(company_id: int, website_id: int):
    db = await get_db()
    docs = await db['grounded_objects'].find(
        {'companyId': company_id, 'websiteId': website_id}
    ).sort('createdAt', -1).to_list(length=200)
    return docs


async def create_grounded_object(company_id: int, website_id: int, title: str, fact: str):
    db = await get_db()
    site = await db['knowledge_sites'].find_one({'companyId': company_id, 'id': website_id})
    if not site:
        return 404, {'error': 'Website not found.'}
    if not fact.strip():
        return 400, {'error': 'Fact text is required.'}

    doc = {
        'id': await next_sequence('grounded_objects'),
        'companyId': company_id,
        'websiteId': website_id,
        'title': title.strip() or 'Grounded fact',
        'fact': fact.strip(),
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow(),
    }
    await db['grounded_objects'].insert_one(doc)

    from app.services.indexer_service import indexer_service
    all_docs = await db['grounded_objects'].find({'companyId': company_id, 'websiteId': website_id}).to_list(length=5000)
    await indexer_service.replace_grounded_objects(all_docs, {'companyId': company_id, 'websiteId': website_id})
    return 201, doc


async def delete_grounded_object(company_id: int, website_id: int, grounded_id: int):
    db = await get_db()
    await db['grounded_objects'].delete_one(
        {'companyId': company_id, 'websiteId': website_id, 'id': grounded_id}
    )
    from app.services.indexer_service import indexer_service
    all_docs = await db['grounded_objects'].find({'companyId': company_id, 'websiteId': website_id}).to_list(length=5000)
    await indexer_service.replace_grounded_objects(all_docs, {'companyId': company_id, 'websiteId': website_id})
    return {'ok': True}


async def crawl_and_index(company_id: int, body: dict):
    url = str(body.get('url') or '').strip()
    if not url:
        return 400, {'error': 'URL is required'}
    max_pages = int(body.get('maxPages') or 20)
    use_sitemap = bool(body.get('useSitemap'))
    website_id = body.get('websiteId')
    website_id = int(website_id) if website_id not in (None, '') else None
    website_label = str(body.get('websiteLabel') or '').strip() or None

    use_advanced = bool(body.get('useAdvanced'))
    depth_limit = body.get('depthLimit')
    depth_limit = int(depth_limit) if depth_limit not in (None, '') else 2
    ignore_depth = bool(body.get('ignoreDepth'))
    exclude_patterns = body.get('excludePatterns') or []
    privacy_patterns = body.get('privacyPatterns') or []
    use_ai = bool(body.get('useAI'))
    seed_urls = body.get('seedUrls') or []
    auth = body.get('auth') or {}

    effective_depth = 999999 if ignore_depth else depth_limit

    merged_seed_urls = list(seed_urls)
    if use_sitemap:
        sitemap = await fetch_sitemap_urls(url, max_urls=max_pages)
        sitemap_urls = sitemap.get('urls', [])
        merged_seed_urls.extend(sitemap_urls)

    from app.services.crawler import crawler_service, advanced_crawler
    from app.services.indexer_service import indexer_service

    if use_advanced:
        pages = await advanced_crawler.crawl(
            url,
            max_pages,
            effective_depth,
            auth,
            {
                'excludePatterns': exclude_patterns,
                'privacyPatterns': privacy_patterns,
                'useAI': use_ai,
                'seedUrls': merged_seed_urls
            }
        )
    else:
        pages = await crawler_service.crawl(
            url,
            max_pages,
            effective_depth,
            auth,
            {
                'excludePatterns': exclude_patterns,
                'privacyPatterns': privacy_patterns,
                'useAI': use_ai,
                'seedUrls': merged_seed_urls
            }
        )

    db = await get_db()
    if website_id is not None:
        site = await db['knowledge_sites'].find_one({'companyId': company_id, 'id': website_id})
        if not site:
            return 400, {'error': 'Invalid website selection.'}
    else:
        normalized = normalize_base_url(url)
        if normalized:
            site = await db['knowledge_sites'].find_one({'companyId': company_id, 'baseUrl': normalized})
            if not site:
                site = {
                    'id': await next_sequence('knowledge_sites'),
                    'companyId': company_id,
                    'baseUrl': normalized,
                    'label': website_label or urlparse(normalized).netloc,
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow(),
                }
                await db['knowledge_sites'].insert_one(site)
            website_id = site['id']

    chunks_created = await indexer_service.index_pages(pages, {
        'companyId': company_id,
        'websiteId': website_id,
        'baseUrl': normalize_base_url(url),
    })

    return 200, {
        'message': 'Crawl and indexing complete',
        'pagesCrawl': len(pages),
        'chunksCreated': chunks_created
    }


async def sitemap_codebase(company_id: int, body: dict):
    project_path = body.get('projectPath')
    if not project_path:
        return 400, {'error': 'projectPath is required'}
    base_url = body.get('baseUrl')
    save_to_company = bool(body.get('saveToCompany', True))
    route_map = create_route_map(str(project_path))
    sitemap_pages = route_map_to_sitemap_pages(route_map, base_url)
    description = summarize_route_map(route_map)

    if save_to_company:
        db = await get_db()
        await db['sitemaps'].update_one(
            {'companyId': company_id},
            {'$set': {'pages': [{'url': p['url'], 'title': p['title']} for p in sitemap_pages], 'routeMap': route_map, 'description': description, 'source': 'codebase', 'updatedAt': datetime.utcnow()}},
            upsert=True,
        )

    return 200, {
        'message': 'Codebase sitemap generated',
        'description': description,
        'counts': route_map['counts'],
        'totalPages': len(sitemap_pages),
        'sitemapPages': sitemap_pages,
        'routeMap': route_map,
    }
