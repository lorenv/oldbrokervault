import { useAuth } from "@/hooks/use-auth";
import { CimGenerator } from "@/components/cim-generator";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";


export default function HomePage() {
  const { user } = useAuth();
  const { data: documents } = useQuery({
    queryKey: ["/api/cim"],
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <CimGenerator />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {documents?.slice()
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 3)
                    .map((doc) => (
                    <a 
                      href={`/documents/${doc.id}`} 
                      key={doc.id} 
                      className="block p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </a>
                  ))}
                  {documents?.length > 3 && (
                    <a 
                      href="/documents" 
                      className="block text-sm text-primary hover:underline text-center mt-1"
                    >
                      View all documents ({documents.length})
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}