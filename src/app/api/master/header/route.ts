import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { resolveMasterAdminEmail } from "@/lib/master-admin-account";
import { countSupportInquiriesByStatus, listSupportInquiries } from "@/lib/support-inquiry-db";

type HeaderNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  href?: string;
  unread?: boolean;
};

function getMasterProfileEmail() {
  return process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase() || "master@uhired.com";
}

async function loadMasterProfileEmail() {
  try {
    return await resolveMasterAdminEmail(prisma);
  } catch {
    return getMasterProfileEmail();
  }
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const email = await loadMasterProfileEmail();
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const liveSessions = await prisma.interviewSession.count({ where: { status: "LIVE" } });
    const newSupportCount = await countSupportInquiriesByStatus(prisma, "NEW");
    const recentCompanies = await prisma.company.count({
      where: { createdAt: { gte: oneDayAgo } },
    });
    const recentPracticeSessions = await prisma.interviewSession.count({
      where: {
        sessionType: "PRACTICE",
        createdAt: { gte: oneDayAgo },
      },
    });

    const latestSupportRows = await listSupportInquiries(prisma, {
      where: { status: "NEW" },
      take: 1,
    });
    const latestSupport = latestSupportRows[0] ?? null;

    const notifications: HeaderNotification[] = [];

    if (liveSessions > 0) {
      notifications.push({
        id: "live-sessions",
        title: "Live interviews",
        body: `${liveSessions} interview${liveSessions === 1 ? "" : "s"} happening right now.`,
        time: "Now",
        href: "/master/practice-sessions",
        unread: true,
      });
    }

    if (newSupportCount > 0) {
      notifications.push({
        id: "support-new",
        title: "New support tickets",
        body: latestSupport
          ? `${newSupportCount} unread message${newSupportCount === 1 ? "" : "s"}. Latest: "${latestSupport.subject}".`
          : `${newSupportCount} unread support message${newSupportCount === 1 ? "" : "s"} waiting for a reply.`,
        time: latestSupport ? formatRelativeTime(latestSupport.createdAt) : "Today",
        href: "/master/support",
        unread: true,
      });
    }

    if (recentCompanies > 0) {
      notifications.push({
        id: "new-companies",
        title: "New companies",
        body: `${recentCompanies} company account${recentCompanies === 1 ? "" : "s"} created in the last 24 hours.`,
        time: "24h",
        href: "/master/companies",
      });
    }

    if (recentPracticeSessions > 0) {
      notifications.push({
        id: "practice-activity",
        title: "Practice interviews",
        body: `${recentPracticeSessions} practice interview${recentPracticeSessions === 1 ? "" : "s"} started in the last 24 hours.`,
        time: "24h",
        href: "/master/practice-sessions",
      });
    }

    if (!notifications.length) {
      notifications.push({
        id: "all-clear",
        title: "You're all caught up",
        body: "No urgent platform alerts right now. New activity will appear here.",
        time: "Just now",
      });
    }

    const unreadCount = notifications.filter((item) => item.unread).length;

    return NextResponse.json({
      profile: {
        email,
        role: "Master Admin",
        initials: email.charAt(0).toUpperCase() || "M",
      },
      notifications,
      unreadCount,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load header data." }, { status: 500 });
  }
}
