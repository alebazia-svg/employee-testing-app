import type { ComponentProps } from 'react';
import { CalendarDays, Camera, CreditCard, CircleCheck, Clock3, ClipboardCheck, TriangleAlert, ReceiptText, MessageCircle, type LucideIcon } from 'lucide-react';
import { CalendarMarkIcon, CameraIcon, Card2Icon, CheckCircleIcon, ClockCircleIcon, ClipboardCheckIcon, DangerTriangleIcon, BillListIcon, ChatRoundDotsIcon } from '@solar-icons/react/bold-duotone';

type IconProps = ComponentProps<typeof ClockCircleIcon>;
function paired(Original: typeof ClockCircleIcon, Outline: LucideIcon) {
  return function PreviewIcon(props: IconProps) {
    return <><Original {...props} className={`pwa-icon-original ${props.className ?? ''}`} /><Outline aria-hidden='true' className={`pwa-icon-outline ${props.className ?? ''}`} style={{ display: 'none' }} strokeWidth={1.8} /></>;
  };
}
export const PremiumCalendarIcon = paired(CalendarMarkIcon, CalendarDays);
export const PremiumCameraIcon = paired(CameraIcon, Camera);
export const PremiumCardIcon = paired(Card2Icon, CreditCard);
export const PremiumCheckCircleIcon = paired(CheckCircleIcon, CircleCheck);
export const PremiumClockIcon = paired(ClockCircleIcon, Clock3);
export const PremiumClipboardCheckIcon = paired(ClipboardCheckIcon, ClipboardCheck);
export const PremiumDangerTriangleIcon = paired(DangerTriangleIcon, TriangleAlert);
export const PremiumBillListIcon = paired(BillListIcon, ReceiptText);
export const PremiumChatIcon = paired(ChatRoundDotsIcon, MessageCircle);
