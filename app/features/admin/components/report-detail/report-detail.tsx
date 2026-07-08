import { ExternalLink } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card/card";
import {
  adminActionLabels,
  reportReasonLabels,
  reportStatusLabels,
  targetTypeLabels,
} from "~/features/admin/components/admin-labels";
import type { AdminReportDetailViewData } from "~/features/admin/types/admin.types";
import { formatMediumDateTime } from "~/lib/date-format";

interface ReportDetailProps {
  detail: AdminReportDetailViewData;
}

export function ReportDetail({ detail }: ReportDetailProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,1.35fr)_16rem]">
      <ReportMetadataCard detail={detail} />
      <TargetCard detail={detail} />
      <AvailableActionsCard detail={detail} />
    </div>
  );
}

function ReportMetadataCard({ detail }: ReportDetailProps) {
  return (
    <Card className="h-fit">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {reportReasonLabels[detail.report.reason]}
          </Badge>
          <Badge variant="outline">
            {reportStatusLabels[detail.report.status]}
          </Badge>
          <Badge variant="outline">
            {targetTypeLabels[detail.report.targetType]}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Report metadata</CardTitle>
          <CardDescription>
            Created {formatDateTime(detail.report.createdAt)}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <MetadataItem label="Report ID" value={detail.report.id} />
        <MetadataItem
          label="Reviewed"
          value={
            detail.report.reviewedAt === null
              ? "Not reviewed"
              : formatDateTime(detail.report.reviewedAt)
          }
        />
        <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Details
          </p>
          <p className="rounded-xl bg-surface px-4 py-3 leading-6">
            {detail.report.details ?? "No details supplied."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AvailableActionsCard({ detail }: ReportDetailProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Available actions</CardTitle>
        <CardDescription>
          These actions are available for this report target.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {detail.availableActions.map((action) => (
          <Badge key={action} variant="outline">
            {adminActionLabels[action]}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function TargetCard({
  className,
  detail,
}: ReportDetailProps & { className?: string | undefined }) {
  const target = detail.target;

  if (target.type === "missing") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{target.label}</CardTitle>
          <CardDescription>The reported target no longer exists.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (target.type === "question") {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{target.label}</CardTitle>
          <CardDescription>
            {target.senderLabel} to @{target.recipientProfile.username}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <blockquote className="rounded-xl bg-surface px-4 py-3 text-sm leading-6">
            {target.text}
          </blockquote>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <MetadataItem label="Status" value={target.status} />
            <MetadataItem label="Identity" value={target.identity} />
            <MetadataItem
              label="Created"
              value={formatDateTime(target.createdAt)}
            />
            <MetadataItem
              label="Deleted"
              value={
                target.deletedAt === null
                  ? "No"
                  : formatDateTime(target.deletedAt)
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (target.type === "thread_item") {
    return (
      <Card className={className}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{target.label}</CardTitle>
              <CardDescription>
                Public answer by @{target.ownerProfile.username}
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link className="gap-2" to={target.publicHref}>
                <ExternalLink aria-hidden="true" className="size-4" />
                Open
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {target.questionText !== null ? (
            <div className="rounded-xl bg-surface px-4 py-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">
                Question
              </p>
              <p className="text-sm leading-6">{target.questionText}</p>
            </div>
          ) : null}
          <div className="rounded-xl bg-surface px-4 py-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">
              Answer
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6">
              {target.answerText}
            </p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <MetadataItem label="Status" value={target.status} />
            <MetadataItem
              label="Published"
              value={
                target.publishedAt === null
                  ? "Not published"
                  : formatDateTime(target.publishedAt)
              }
            />
            <MetadataItem
              label="Deleted"
              value={
                target.deletedAt === null
                  ? "No"
                  : `${formatDateTime(target.deletedAt)} by ${target.deletedBy ?? "unknown"}`
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">@{target.username}</CardTitle>
            <CardDescription>{target.displayName}</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link className="gap-2" to={target.publicHref}>
              <ExternalLink aria-hidden="true" className="size-4" />
              Open
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
        <MetadataItem label="Status" value={target.status} />
        <MetadataItem label="Created" value={formatDateTime(target.createdAt)} />
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Bio
          </p>
          <p className="rounded-xl bg-surface px-4 py-3 leading-6">
            {target.bio ?? "No bio."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </p>
      <p className="leading-6">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return formatMediumDateTime(value);
}
