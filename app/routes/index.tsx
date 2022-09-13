import { Suspense, useEffect, useMemo, useState } from "react";
import { defer, type LoaderArgs } from "@remix-run/node";
import {
  Await,
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
  useTransition,
} from "@remix-run/react";
import useInfiniteScroll from "react-infinite-scroll-hook";

export function loader({ request }: LoaderArgs) {
  const url = new URL(request.url);
  let page = Number(url.searchParams.get("page") || "1");
  page = !Number.isSafeInteger(page) || page < 1 ? 1 : page;

  const usersPagePromise = new Promise((r) => setTimeout(r, 1500)).then(() =>
    fetch(`https://reqres.in/api/users?page=${page}`)
      .then((response) => response.json())
      .then(
        ({
          total_pages: totalPages,
          data: users,
        }: {
          total_pages: number;
          data: { id: string; email: string }[];
        }) => ({
          page,
          totalPages,
          users,
        })
      )
  );

  return defer({
    usersPage: usersPagePromise,
  });
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const transition = useTransition();
  const [searchParams] = useSearchParams();

  const [scrollState, setScrollState] = useState<{
    hasNextPage: boolean;
    page?: number;
    pages?: {
      page: number;
      users: Awaited<typeof loaderData["usersPage"]>["users"];
    }[];
  }>({
    hasNextPage: false,
  });

  const { usersPage } = loaderData;
  const page = Number(searchParams.get("page") || "1");
  const lowestPage = useMemo(() => {
    if (scrollState.pages) {
      return Math.min(...scrollState.pages.map((page) => page.page));
    }
    return page;
  }, [page, scrollState]);

  const usersPageToRender = useMemo(() => {
    if (!scrollState.pages) {
      return usersPage;
    }

    const users = scrollState.pages.flatMap((page) => page.users);

    return { users };
  }, [scrollState, usersPage]);

  useEffect(() => {
    let aborted = false;
    usersPage
      .then(({ page, totalPages, users }) => {
        if (aborted) return;
        setScrollState((state) => ({
          page,
          hasNextPage: page < totalPages,
          pages: [
            ...(state.pages?.filter((p) => p.page !== page) || []),
            { page, users },
          ].sort((a, b) => a.page - b.page),
        }));
      })
      .catch();
    return () => {
      aborted = true;
    };
  }, [usersPage]);

  const [sentryRef] = useInfiniteScroll({
    loading: transition.state === "loading",
    hasNextPage: scrollState.hasNextPage,
    onLoadMore: () => {
      if (typeof scrollState.page !== "number") return;
      const params = new URLSearchParams(location.search);
      params.set("page", String(scrollState.page + 1));
      navigate(`${location.pathname}?${params.toString()}`);
    },
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
      <h1>Welcome to Remix</h1>
      {lowestPage > 1 && (
        <Link to={`?page=${lowestPage - 1}`}>Load Prevous</Link>
      )}
      <Suspense>
        <Await resolve={usersPageToRender}>
          {({ users }) => (
            <>
              <ul>
                {users.map(({ id, email }) => (
                  <li
                    key={id}
                    style={{
                      padding: "8em",
                    }}
                  >
                    {email}
                  </li>
                ))}
              </ul>
              {scrollState.hasNextPage && (
                <div ref={sentryRef}>Loading more....</div>
              )}
            </>
          )}
        </Await>
      </Suspense>
    </div>
  );
}
