// 공용 확인창. 모든 삭제 등 되돌리기 어려운 동작 전에 띄운다.
export default function ConfirmDialog({ open, title = '삭제 확인', message, confirmText = '삭제', danger = true, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
        <h3>{title}</h3>
        <p className="confirm-text">{message}</p>
        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onCancel}>취소</button>
          <button className={danger ? 'btn-primary btn-danger-solid' : 'btn-primary'} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
