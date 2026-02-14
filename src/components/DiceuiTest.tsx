import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function DiceuiTest() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Diceui Test Component</CardTitle>
        <CardDescription>Testing core diceui components</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button>Click Me (Diceui Button)</Button>
          <Button variant="secondary">Secondary Button</Button>
        </div>
        <div className="flex gap-2">
          <Badge>diceui</Badge>
          <Badge variant="secondary">components</Badge>
          <Badge variant="destructive">working</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          If you see this, diceui components are properly installed!
        </p>
      </CardContent>
    </Card>
  )
}
