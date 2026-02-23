import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SettingsLayout, useSettingsAccess } from "@/components/layout/settings-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Pencil, Shield, Lock, Globe, Mail, Building2 } from "lucide-react";

interface WhitelistRule {
  id: number;
  userId: number;
  organizationId: number | null;
  ruleType: "domain" | "email" | "organization";
  ruleValue: string;
  appliesToAllDeals: boolean;
  cimDocumentId: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  ruleType: "domain" as "domain" | "email" | "organization",
  ruleValue: "",
  appliesToAllDeals: true,
  cimDocumentId: null as number | null,
  isActive: true,
  notes: "",
};

const ruleTypeConfig = {
  domain: { label: "Domain", icon: Globe, placeholder: "e.g. blackstone.com", description: "Auto-approve all emails from this domain" },
  email: { label: "Email", icon: Mail, placeholder: "e.g. john@buyer.com", description: "Auto-approve this specific email address" },
  organization: { label: "Organization", icon: Building2, placeholder: "Company ID", description: "Auto-approve contacts linked to this company" },
};

export default function NdaWhitelistPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canEdit, isViewOnly } = useSettingsAccess();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WhitelistRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WhitelistRule | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: rules = [], isLoading } = useQuery<WhitelistRule[]>({
    queryKey: ["/api/nda-whitelist"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) =>
      apiRequest("POST", "/api/nda-whitelist", { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nda-whitelist"] });
      setIsAddOpen(false);
      setForm({ ...emptyForm });
      toast({ title: "Whitelist rule created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create rule", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) =>
      apiRequest("PATCH", `/api/nda-whitelist/${id}`, { body: data }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nda-whitelist"] });
      setEditingRule(null);
      toast({ title: "Whitelist rule updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update rule", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nda-whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nda-whitelist"] });
      setDeleteConfirm(null);
      toast({ title: "Whitelist rule deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete rule", variant: "destructive" });
    },
  });

  const toggleActive = (rule: WhitelistRule) => {
    updateMutation.mutate({ id: rule.id, data: { isActive: !rule.isActive } });
  };

  const openEdit = (rule: WhitelistRule) => {
    setForm({
      ruleType: rule.ruleType,
      ruleValue: rule.ruleValue,
      appliesToAllDeals: rule.appliesToAllDeals,
      cimDocumentId: rule.cimDocumentId,
      isActive: rule.isActive,
      notes: rule.notes || "",
    });
    setEditingRule(rule);
  };

  const openAdd = () => {
    setForm({ ...emptyForm });
    setIsAddOpen(true);
  };

  const handleSubmit = () => {
    if (!form.ruleValue.trim()) {
      toast({ title: "Rule value is required", variant: "destructive" });
      return;
    }
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isDialogOpen = isAddOpen || editingRule !== null;
  const closeDialog = () => {
    setIsAddOpen(false);
    setEditingRule(null);
  };

  const activeRules = rules.filter(r => r.isActive);
  const inactiveRules = rules.filter(r => !r.isActive);

  return (
    <SettingsLayout
      title="NDA Whitelist"
      description="Auto-approve NDA signers based on domain, email, or organization rules. Whitelisted signers get immediate CIM access without manual approval."
    >
      {isViewOnly && (
        <Alert className="mb-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>You have view-only access to whitelist settings.</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-600">
          {rules.length === 0 ? "No whitelist rules configured" : `${activeRules.length} active rule${activeRules.length !== 1 ? "s" : ""}`}
          {inactiveRules.length > 0 && `, ${inactiveRules.length} inactive`}
        </div>
        {canEdit && (
          <Button onClick={openAdd} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <Shield className="h-10 w-10 mx-auto text-gray-400 mb-3" />
          <h3 className="text-gray-900 font-medium mb-1">No whitelist rules yet</h3>
          <p className="text-gray-600 text-sm mb-4 max-w-md mx-auto">
            Add rules to auto-approve NDA signers from trusted domains, specific email addresses, or organizations.
          </p>
          {canEdit && (
            <Button onClick={openAdd} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Your First Rule
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3" style={{ width: "15%" }}>Type</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3" style={{ width: "30%" }}>Value</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3" style={{ width: "15%" }}>Scope</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3" style={{ width: "15%" }}>Status</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3" style={{ width: "15%" }}>Notes</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3" style={{ width: "10%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => {
                  const config = ruleTypeConfig[rule.ruleType];
                  const Icon = config.icon;
                  return (
                    <tr key={rule.id} className={`border-b last:border-b-0 hover:bg-gray-50 ${!rule.isActive ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-500" />
                          <Badge variant="outline" className="text-xs">{config.label}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900 font-medium truncate block">{rule.ruleValue}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {rule.appliesToAllDeals ? "All deals" : `Deal #${rule.cimDocumentId}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={() => toggleActive(rule)}
                            disabled={updateMutation.isPending}
                          />
                        ) : (
                          <Badge variant={rule.isActive ? "default" : "secondary"}>
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 truncate block">{rule.notes || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(rule)}>
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Whitelist Rule" : "Add Whitelist Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <Select
                value={form.ruleType}
                onValueChange={(val: "domain" | "email" | "organization") => setForm(f => ({ ...f, ruleType: val, ruleValue: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ruleTypeConfig) as Array<keyof typeof ruleTypeConfig>).map(type => (
                    <SelectItem key={type} value={type}>
                      {ruleTypeConfig[type].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">{ruleTypeConfig[form.ruleType].description}</p>
            </div>

            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={form.ruleValue}
                onChange={e => setForm(f => ({ ...f, ruleValue: e.target.value }))}
                placeholder={ruleTypeConfig[form.ruleType].placeholder}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Apply to all deals</Label>
                <p className="text-xs text-gray-500">When off, the rule only applies to a specific deal</p>
              </div>
              <Switch
                checked={form.appliesToAllDeals}
                onCheckedChange={(checked) => setForm(f => ({ ...f, appliesToAllDeals: checked, cimDocumentId: checked ? null : f.cimDocumentId }))}
              />
            </div>

            {!form.appliesToAllDeals && (
              <div className="space-y-2">
                <Label>Deal / Document ID</Label>
                <Input
                  type="number"
                  value={form.cimDocumentId || ""}
                  onChange={e => setForm(f => ({ ...f, cimDocumentId: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Enter CIM document ID"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm(f => ({ ...f, isActive: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Trusted PE firm, pre-approved by deal team"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingRule ? "Save Changes" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Whitelist Rule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Are you sure you want to delete the {deleteConfirm?.ruleType} rule for <strong>{deleteConfirm?.ruleValue}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}
