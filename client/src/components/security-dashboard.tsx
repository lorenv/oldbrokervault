import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, AlertTriangle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SecurityDashboard() {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);

  const { data: securityHealth, isLoading } = useQuery({
    queryKey: ["/api/security/health"],
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Lock className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Bank-Level Security Active</h3>
            <p className="text-muted-foreground">
              Your data is protected with enterprise-grade security measures.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSecurityLevel = (score: string) => {
    const [current] = score.split('/');
    const num = parseInt(current);
    if (num >= 6) return { level: 'Bank-Level', color: 'bg-green-500', icon: CheckCircle };
    if (num >= 4) return { level: 'Enterprise', color: 'bg-yellow-500', icon: AlertTriangle };
    return { level: 'Basic', color: 'bg-red-500', icon: AlertTriangle };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Health Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-20 bg-muted rounded" />
            </div>
          ) : securityHealth ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Security Score</h3>
                  <p className="text-muted-foreground">Overall security assessment</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{securityHealth.security.score}</div>
                  <Badge 
                    variant="secondary" 
                    className={`${getSecurityLevel(securityHealth.security.score).color} text-white`}
                  >
                    {getSecurityLevel(securityHealth.security.score).level}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">HTTPS Enabled</span>
                      {securityHealth.security.checks.https ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Session Secret</span>
                      {securityHealth.security.checks.sessionSecret ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Database Connection</span>
                      {securityHealth.security.checks.databaseUrl ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Security Headers</span>
                      {Object.values(securityHealth.security.checks.headers).filter(Boolean).length >= 3 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Audit Logs</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {securityHealth.security.auditLogCount} entries
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {showDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Security Header Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(securityHealth.security.checks.headers).map(([header, enabled]) => (
                      <div key={header} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{header.replace(/([A-Z])/g, ' $1')}</span>
                        {enabled ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {securityHealth.security.recommendations?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Security Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {securityHealth.security.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Security Check Failed</h3>
              <p className="text-muted-foreground">
                Unable to perform security health check.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank-Level Security Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-green-500 mt-1" />
              <div>
                <h4 className="font-medium">End-to-End Encryption</h4>
                <p className="text-sm text-muted-foreground">All data encrypted in transit and at rest</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-green-500 mt-1" />
              <div>
                <h4 className="font-medium">Advanced Authentication</h4>
                <p className="text-sm text-muted-foreground">Secure password hashing with timing-safe comparison</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
              <div>
                <h4 className="font-medium">Rate Limiting</h4>
                <p className="text-sm text-muted-foreground">Protection against brute force attacks</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-green-500 mt-1" />
              <div>
                <h4 className="font-medium">Audit Logging</h4>
                <p className="text-sm text-muted-foreground">Complete audit trail of all security events</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}