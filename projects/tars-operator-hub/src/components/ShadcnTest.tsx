import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ShadcnTest() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>shadcn/ui Setup Test</CardTitle>
        <CardDescription>
          Testing the installation of shadcn/ui components
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Badge>Test</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <div className="flex gap-2">
          <Button>Default Button</Button>
          <Button variant="secondary">Secondary Button</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          ✓ shadcn/ui is properly configured!
        </p>
      </CardContent>
    </Card>
  )
}
