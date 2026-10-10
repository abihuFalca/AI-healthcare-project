from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
def get_user_notifications(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, title, message, type, is_read, link_url, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 30
    """, (user["id"],))
    notifs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"notifications": notifs}

@router.put("/{id}/read")
def mark_notification_read(id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", (id, user["id"]))
    conn.commit()
    conn.close()
    return {"message": "Notification marked as read"}

@router.put("/read-all")
def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"message": "All notifications marked as read"}
