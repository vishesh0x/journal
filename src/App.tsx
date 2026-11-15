import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/skeletons";

import Home from "@/pages/Home";
import PostDetail from "@/pages/PostDetail";
import Archive from "@/pages/Archive";
import Search from "@/pages/Search";
import TagDetail from "@/pages/TagDetail";
import About from "@/pages/About";
import CustomPage, { PrivacyPage, TermsPage } from "@/pages/StaticPage";
import Auth from "@/pages/Auth";
import Unsubscribe from "@/pages/Unsubscribe";
import NotFound from "@/pages/NotFound";

// Dashboard routes are only ever visited by the site owner, so they're
// split into separate chunks and only downloaded when actually
// navigated to — public visitors never pay for this code.
const PostsList = lazy(() => import("@/pages/dashboard/PostsList"));
const PostEditor = lazy(() => import("@/pages/dashboard/PostEditor"));
const TagsManager = lazy(() => import("@/pages/dashboard/TagsManager"));
const PagesList = lazy(() => import("@/pages/dashboard/PagesList"));
const PageEditor = lazy(() => import("@/pages/dashboard/PageEditor"));
const Subscribers = lazy(() => import("@/pages/dashboard/Subscribers"));
const Settings = lazy(() => import("@/pages/dashboard/Settings"));

function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  if (loading) return <PageSkeleton />;
  if (!isAuthenticated || !isAdmin) return <Navigate to="/auth" replace />;
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="/search" element={<Search />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/posts/:slug" element={<PostDetail />} />
      <Route path="/tags/:slug" element={<TagDetail />} />
      <Route path="/p/:slug" element={<CustomPage />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />

      <Route
        path="/dashboard"
        element={
          <RequireAdmin>
            <PostsList />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/posts/:id"
        element={
          <RequireAdmin>
            <PostEditor />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/pages"
        element={
          <RequireAdmin>
            <PagesList />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/pages/:id"
        element={
          <RequireAdmin>
            <PageEditor />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/tags"
        element={
          <RequireAdmin>
            <TagsManager />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/subscribers"
        element={
          <RequireAdmin>
            <Subscribers />
          </RequireAdmin>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <RequireAdmin>
            <Settings />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
