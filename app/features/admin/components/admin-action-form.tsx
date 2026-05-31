import { ShieldCheck } from "lucide-react";
import { Form, useNavigation } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import type { AdminActionType } from "~/features/admin/admin.schema";
import { requiresAdminActionNotes } from "~/features/admin/admin.schema";
import type { AdminReportActionResult } from "~/features/admin/admin-actions.server";
import { adminActionLabels } from "~/features/admin/components/admin-labels";
import { cn } from "~/lib/utils";

interface AdminActionFormProps {
  actionResult: AdminReportActionResult | undefined;
  availableActions: AdminActionType[];
}

export function AdminActionForm({
  actionResult,
  availableActions,
}: AdminActionFormProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const fieldErrors =
    actionResult?.status === "invalid" ? actionResult.fieldErrors : {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Moderation action</CardTitle>
        <CardDescription>
          Actions are audited and applied transactionally.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {actionResult?.status === "invalid" || actionResult?.status === "denied" ? (
          <p className="mb-4 text-sm leading-6 text-destructive" role="alert">
            {actionResult.formError}
          </p>
        ) : null}
        {actionResult?.status === "dismissed" ||
        actionResult?.status === "actioned" ? (
          <p className="mb-4 text-sm leading-6 text-muted-foreground" role="status">
            {adminActionLabels[actionResult.actionType]} applied.
          </p>
        ) : null}

        <Form className="flex flex-col gap-4" method="post">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="actionType">
              Action
            </label>
            <select
              aria-invalid={fieldErrors.actionType === undefined ? undefined : true}
              className={cn(
                "flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                fieldErrors.actionType !== undefined
                  ? "border-destructive focus-visible:ring-destructive/20"
                  : "",
              )}
              defaultValue={availableActions[0] ?? "dismiss"}
              id="actionType"
              name="actionType"
            >
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {adminActionLabels[action]}
                  {requiresAdminActionNotes(action) ? " *" : ""}
                </option>
              ))}
            </select>
            {fieldErrors.actionType !== undefined ? (
              <p className="text-sm leading-6 text-destructive">
                {fieldErrors.actionType}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="notes">
              Notes
            </label>
            <Textarea
              aria-invalid={fieldErrors.notes === undefined ? undefined : true}
              id="notes"
              name="notes"
              placeholder="Internal moderation note"
            />
            {fieldErrors.notes !== undefined ? (
              <p className="text-sm leading-6 text-destructive">
                {fieldErrors.notes}
              </p>
            ) : null}
          </div>

          <Button className="w-fit gap-2" disabled={isSubmitting} type="submit">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {isSubmitting ? "Applying" : "Apply action"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
