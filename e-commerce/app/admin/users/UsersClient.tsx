"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FiSearch, FiLock, FiUnlock, FiShield } from "react-icons/fi";
import { API_PATHS } from "@/utils/apiPaths";
import AdminPagination from "@/app/admin/components/AdminPagination";
import AdminDialog from "@/app/admin/components/AdminDialog";
import { getAdminErrorMessage } from "@/utils/adminError";
import { formatAdminOrderDate } from "@/utils/adminOrders";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import AdminRefreshButton from "@/app/admin/components/AdminRefreshButton";

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
  const [selectedUser, setSelectedUser] = useState<AccountRow | null>(null);
  const [statusError, setStatusError] = useState("");
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
    setStatusError("");
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
      setSelectedUser(null);
    } catch (error: unknown) {
      const message = getAdminErrorMessage(error, "Unable to update this account. Please refresh and try again.");
      setStatusError(message);
      toast.error(message);
    } finally {
      updating.current = false;
      setUpdatingUser(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <AdminPageHeader title="User accounts" description="Find customer accounts and manage access. Administrator accounts are protected.">
        <AdminRefreshButton isLoading={isLoading} onRefresh={handleRefresh} />
      </AdminPageHeader>

      {/* Search Input Bar */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              id="account-search"
              aria-label="Search accounts by name or email"
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
            <button type="button" onClick={handleRefresh} className="mt-3 block w-full font-semibold text-teal-700 underline">Try again</button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-14 text-center text-sm text-slate-500 font-medium">
            No accounts matching your search query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-sm">
              <thead className="bg-slate-200 border-b border-slate-300 text-xs font-bold text-slate-700 uppercase ">
                <tr>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
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
                      <p className="mt-1 text-xs text-slate-500">{user.emailVerified ? "Email verified" : "Email not verified"}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      {user.role === "ADMIN" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <FiShield className="text-xs" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-sm font-semibold bg-slate-100 text-slate-700">
                          Customer
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {user.status === "BLOCKED" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {formatAdminOrderDate(user.createdAt)}
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
                            setStatusError("");
                            setSelectedUser(user);
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
                              <span>{updatingUser === user.id ? "Updating..." : "Unblock"}</span>
                            </>
                          ) : (
                            <>
                              <FiLock className="text-sm" />
                              <span>{updatingUser === user.id ? "Updating..." : "Block account"}</span>
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

        {!isLoading && !error ? <div className="px-5 pb-4">
          <AdminPagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={10}
            hasMore={hasMore}
            isLoading={isLoading}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div> : null}
      </div>
      {selectedUser ? (
        <AdminDialog
          title={selectedUser.status === "BLOCKED" ? "Unblock account?" : "Block account?"}
          isBusy={Boolean(updatingUser)}
          onClose={() => setSelectedUser(null)}
        >
          <p className="break-words text-sm font-semibold">{selectedUser.name || "Customer"}</p>
          <p className="mt-1 break-all text-sm text-slate-500">{selectedUser.email || "No email recorded"}</p>
          <p className="mt-4 text-sm leading-6">
            {selectedUser.status === "BLOCKED" ? "This customer will be able to sign in again. Previously revoked sessions will remain invalid." : "This customer will lose access and their active sessions will be revoked."}
          </p>
          {statusError ? <p role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{statusError}</p> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" disabled={Boolean(updatingUser)} onClick={() => setSelectedUser(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancel</button>
            <button type="button" disabled={Boolean(updatingUser)} onClick={() => { void handleStatusChange(selectedUser); }} className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {updatingUser ? "Updating..." : selectedUser.status === "BLOCKED" ? "Unblock account" : "Block account"}
            </button>
          </div>
        </AdminDialog>
      ) : null}
    </div>
  );
}
