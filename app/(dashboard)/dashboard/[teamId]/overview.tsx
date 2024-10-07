import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubIcon } from "lucide-react";

export function Overview() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Overview</h1>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Github Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-4 sm:mb-0">
                <p className="font-medium">Integration Status: Not Connected</p>
                <p className="text-sm text-muted-foreground">
                  No active integration
                </p>
              </div>
              <form>
                <Button type="submit" variant="primary">
                  <GithubIcon className="mr-2 h-4 w-4" />
                  Connect Github
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
