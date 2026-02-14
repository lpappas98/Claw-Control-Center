import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <Card
      className={cn(
        'bg-[#101426] border-[#242b45] rounded-[14px]',
        className
      )}
      {...props}
    >
      {children}
    </Card>
  )
}

export function PanelHeader({ children, className, ...props }: PanelHeaderProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row gap-4 justify-between items-start pb-3',
        className
      )}
      {...props}
    >
      {children}
    </CardHeader>
  )
}

export function PanelContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CardContent className={cn('p-4', className)} {...props}>
      {children}
    </CardContent>
  )
}
