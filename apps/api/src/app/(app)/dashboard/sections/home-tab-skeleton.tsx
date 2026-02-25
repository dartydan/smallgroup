import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Line({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export function HomeTabSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <Line className="h-5 w-40" />
          <Line className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Line className="h-9 w-full" />
          <Line className="h-9 w-full" />
          <Line className="h-9 w-4/5" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Line className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Line className="h-4 w-full" />
            <Line className="h-4 w-11/12" />
            <Line className="h-4 w-10/12" />
            <Line className="h-4 w-8/12" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Line className="h-5 w-44" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Line className="h-16 w-full" />
            <Line className="h-16 w-full" />
            <Line className="h-16 w-5/6" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
