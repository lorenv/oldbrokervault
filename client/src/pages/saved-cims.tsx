import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { CimDocument } from "@shared/schema";

export default function SavedCimsPage() {
  const { data: documents } = useQuery<CimDocument[]>({
    queryKey: ["/api/cim"],
  });

  const savedDocs = documents?.filter(doc => doc.isSaved) || [];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Saved CIMs</h1>
        <div className="space-y-6">
          {savedDocs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <CardTitle>{doc.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  {doc.websiteUrl && (
                    <p className="text-sm">
                      Website: <a href={doc.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{doc.websiteUrl}</a>
                    </p>
                  )}
                  {/* Add more CIM details as needed */}
                </div>
              </CardContent>
            </Card>
          ))}
          {savedDocs.length === 0 && (
            <p className="text-center text-muted-foreground">No saved CIMs yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
