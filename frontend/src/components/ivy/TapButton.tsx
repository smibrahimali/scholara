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
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      className={cn('min-h-12 transition-colors disabled:opacity-60', className)}
      {...props}
    />
  );
}
