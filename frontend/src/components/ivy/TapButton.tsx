import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/cn';

export function TapButton({
  className,
  disabled,
  ...props
}: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      whileTap={
        disabled ? undefined : { y: 1, boxShadow: 'none' }
      }
      transition={{ duration: 0.2, ease: 'easeOut' }}
      disabled={disabled}
      className={cn(
        'min-h-12 transition-all duration-200 ease-out',
        'active:translate-y-[1px] active:shadow-none',
        'disabled:cursor-not-allowed disabled:bg-[#F3F2F0] disabled:text-[#9CA3AF] disabled:shadow-none disabled:opacity-100',
        className,
      )}
      {...props}
    />
  );
}
