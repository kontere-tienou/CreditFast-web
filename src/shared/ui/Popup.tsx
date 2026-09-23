import type { ReactNode } from 'react';
import { AppModal, type AppModalSize } from '@/shared/ui/AppModal';

type PopupProps = {
  open?: boolean;
  title: string;
  titleId?: string;
  subtitle?: ReactNode;
  icon?: string;
  onClose?: () => void;
  closeDisabled?: boolean;
  zIndex?: number;
  describedBy?: string;
  size?: AppModalSize;
  children: ReactNode;
};

export function Popup({ size = 'sm', zIndex = 2600, ...props }: PopupProps) {
  return <AppModal {...props} size={size} zIndex={zIndex} role="alertdialog" />;
}
