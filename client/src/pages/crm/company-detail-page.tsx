import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskList } from "@/components/crm/task-list";
import { ArrowLeft, Building2, Globe, MapPin, Phone, Users, Briefcase, CheckSquare, Plus } from "lucide-react";

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ["/api/crm/companies", id],
    queryFn: () => apiRequest("GET", `/api/crm/companies/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  // Fetch tasks
  const { data: tasks } = useQuery<any[]>({
    queryKey: [`/api/crm/tasks/company/${id}`],
    queryFn: () => apiRequest("GET", `/api/crm/tasks/company/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center py-12">
        <h2 className="text-xl font-semibold">Company not found</h2>
        <Button asChild className="mt-4"><Link href="/companies">Back to Companies</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header - stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/companies"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold truncate">{(company as any).name}</h1>
            {(company as any).industry && <p className="text-gray-500 text-sm">{(company as any).industry}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(company as any).website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <a href={(company as any).website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {(company as any).website}
                  </a>
                </div>
              )}
              {(company as any).phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{(company as any).phone}</span>
                </div>
              )}
              {((company as any).city || (company as any).state) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>{[(company as any).city, (company as any).state, (company as any).country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {(company as any).size && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>{(company as any).size} employees</span>
                </div>
              )}
              {(company as any).description && (
                <div className="pt-4 border-t">
                  <p className="text-gray-600">{(company as any).description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Associated Contacts</CardTitle></CardHeader>
            <CardContent>
              {(company as any).contacts?.length > 0 ? (
                <div className="space-y-2">
                  {(company as any).contacts.map((contact: any) => (
                    <Link key={contact.id} href={`/contacts/${contact.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                        <p className="text-sm text-gray-500">{contact.email}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No contacts associated</p>
              )}
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Tasks
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsTaskDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent>
              <TaskList
                tasks={tasks || []}
                objectType="company"
                objectId={parseInt(id!)}
                onEditTask={(task) => setEditingTask(task)}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
            <CardContent>
              {(company as any).deals?.length > 0 ? (
                <div className="space-y-2">
                  {(company as any).deals.map((deal: any) => (
                    <Link key={deal.id} href={`/deals/${deal.id}`} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                      <Briefcase className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">{deal.name}</p>
                        {deal.amount && <p className="text-sm text-green-600">${parseFloat(deal.amount).toLocaleString()}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No deals yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Dialogs */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        objectType="company"
        objectId={parseInt(id!)}
      />

      <TaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        objectType="company"
        objectId={parseInt(id!)}
      />
    </div>
  );
}
