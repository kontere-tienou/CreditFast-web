import type { MouseEvent, ReactNode } from 'react';

export type AppModalSize = 'sm' | 'md' | 'lg' | 'xl';

const WIDTH: Record<AppModalSize, number> = {
  sm: 460,
  md: 560,
  lg: 820,
  xl: 960,
};

type AppModalProps = {
  id?: string;
  open?: boolean;
  parked?: boolean;
  size?: AppModalSize;
  width?: number;
  className?: string;
  title?: string;
  titleId?: string;
  subtitle?: ReactNode;
  icon?: string;
  onClose?: () => void;
  closeDisabled?: boolean;
  zIndex?: number;
  role?: 'dialog' | 'alertdialog';
  describedBy?: string;
  children: ReactNode;
};

export function AppModal({
  id,
  open = true,
  parked = false,
  size = 'md',
  width,
  className = '',
  title,
  titleId,
  subtitle,
  icon,
  onClose,
  closeDisabled = false,
  zIndex,
  role = 'dialog',
  describedBy,
  children,
}: AppModalProps) {
  if (!parked && !open) {
    return null;
  }

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && onClose && !closeDisabled) {
      onClose();
    }
  };

  return (
    <div
      id={id}
      className="cf-app-modal-backdrop"
      style={{
        ...(zIndex != null ? { zIndex } : {}),
        ...(parked ? { display: 'none' } : {}),
      }}
      onClick={onBackdrop}
    >
      <div
        className={['cf-app-modal', className].filter(Boolean).join(' ')}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        style={{ maxWidth: width ?? WIDTH[size] }}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <div className="cf-app-modal-header">
            <div className="cf-app-modal-header-main">
              {icon ? (
                <div className="cf-app-modal-icon">
                  <i className={`fas ${icon}`}></i>
                </div>
              ) : null}
              <div style={{ minWidth: 0 }}>
                <h3 id={titleId}>{title}</h3>
                {subtitle ? <p>{subtitle}</p> : null}
              </div>
            </div>
            {onClose ? (
              <button
                type="button"
                className="cf-app-modal-close"
                onClick={onClose}
                disabled={closeDisabled}
                title="Fermer"
              >
                <i className="fas fa-times"></i>
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
