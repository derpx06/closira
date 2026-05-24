from app.db.mongo import get_db
from app.core.compat import ReturnDocument


async def next_sequence(sequence_name: str) -> int:
    db = await get_db()
    result = await db['counters'].find_one_and_update(
        {'_id': sequence_name},
        {'$inc': {'seq': 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    seq = (result or {}).get('seq')
    if not isinstance(seq, int):
        raise RuntimeError(f"Failed to allocate sequence number for '{sequence_name}'.")
    return seq
