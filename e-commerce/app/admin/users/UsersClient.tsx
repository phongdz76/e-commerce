"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FiSearch, FiRefreshCw, FiLock, FiUnlock, FiShield } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import AdminPagination from "@/app/admin/components/AdminPagination";

interface AccountRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function UsersClient() {
  const [users, setUsers] = useState<AccountRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const updating = useRef(false);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await axios.get(API_PATHS.ADMIN.USERS, {
          params: { search, page },
        });
        if (active) {
          setUsers(response.data.users);
          setTotal(response.data.total ?? 0);
          setTotalPages(response.data.totalPages ?? 1);
          setHasMore(response.data.hasMore);
        }
      } catch {
        if (active) {
          setError("Failed to load user accounts directory. Please try again.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadUsers();
    return () => {
      active = false;
    };
  }, [search, page, refresh]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
    setRefresh((previous) => previous + 1);
  };

  const handleRefresh = () => {
    setRefresh((previous) => previous + 1);
  };

  const handleStatusChange = async (user: AccountRow) => {
    if (updating.current || user.role === "ADMIN") {
      return;
    }
    updating.current = true;
    setUpdatingUser(user.id);
    const status = user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    try {
      await axios.patch(API_PATHS.ADMIN.USER_STATUS(user.id), { status });
      toast.success(
        status === "BLOCKED"
          ? "Account locked and all active sessions revoked."
          : "Account unlocked successfully.",
      );
      handleRefresh();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(
        typeof message === "string"
          ? message
          : "Failed to update account status.",
      );
    } finally {
      updating.current = false;
      setUpdatingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 ">
            User Accounts & Security
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer directories, inspect role authorizations, and lock or restore accounts.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition shadow-xs disabled:opacity-70"
        >
          <FiRefreshCw className={`text-sm ${isLoading ? "animate-spin" : ""}`} />
          <span>{isLoading ? "Refreshing..." : "Refresh Users"}</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              id="account-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={80}
              placeholder="Search by name or email address..."
              className="w-full rounded-md border border-slate-300 pl-9 pr-4 py-2 text-sm outline-none focus:border-teal-500 text-slate-800 transition"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-slate-700 hover:bg-slate-800 px-4 py-2 text-sm font-bold text-white transition shadow-xs"
          >
            Search
          </button>

          {search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
              className="rounded-md border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition shadow-xs"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Users Table Card */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            Loading user directory...
          </div>
        ) : error ? (
          <div className="p-10 text-center text-sm text-rose-700 font-medium">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            No accounts matching your search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase ">
                <tr>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Role & Privilege</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Access Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">
                        {user.name || "Unnamed Customer"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {user.email || "No email"}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      {user.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <FiShield className="text-xs" />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-sm font-semibold bg-slate-100 text-slate-700">
                          CUSTOMER
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {user.status === "BLOCKED" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("en-US")}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {user.role === "ADMIN" ? (
                        <span className="text-xs text-slate-400 italic">
                          Protected Account
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(updatingUser)}
                          onClick={() => {
                            void handleStatusChange(user);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition shadow-xs border ${
                            user.status === "BLOCKED"
                              ? "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                              : "border-slate-300 bg-white text-rose-700 hover:bg-rose-50"
                          } disabled:opacity-50`}
                        >
                          {user.status === "BLOCKED" ? (
                            <>
                              <FiUnlock className="text-sm" />
                              <span>{updatingUser === user.id ? "Updating..." : "Unlock"}</span>
                            </>
                          ) : (
                            <>
                              <FiLock className="text-sm" />
                              <span>{updatingUser === user.id ? "Updating..." : "Lock Account"}</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 pb-4">
          <AdminPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={10}
            hasMore={hasMore}
            isLoading={isLoading}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      </div>
    </div>
  );
}
