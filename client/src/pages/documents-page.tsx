import { useQuery } from "@tanstack/react-query";
import { CimDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Link } from "wouter";

export default function DocumentsPage() {
  const { data: documents } = useQuery<CimDocument[]>({
    queryKey: ["/api/cim"],
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My CIM Documents</h1>
          <Link href="/">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Create New CIM
            </Button>
          </Link>
        </div>

        <div className="grid gap-4">
          {documents?.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle>{doc.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(doc.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Regenerations: {doc.regenerationCount}
                </div>
              </CardContent>
            </Card>
          ))}

          {documents?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No CIM documents yet. Create your first one!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
