import { Card, CardContent } from "@/components/ui/card";

export function SecondaryLoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Loading additional sections...
        </p>
      </CardContent>
    </Card>
  );
}
