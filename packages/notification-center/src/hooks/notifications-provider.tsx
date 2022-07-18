import React, { useContext, useEffect, useState } from 'react';
import { useApi } from './use-api.hook';
import { IMessage, ButtonTypeEnum, MessageActionStatusEnum } from '@novu/shared';
import { NotificationsContext } from '../store/notifications.context';
import { IAuthContext, IStoreQuery } from '../index';
import { AuthContext } from '../store/auth.context';
import { useNovuContext } from './use-novu-context.hook';

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { api } = useApi();
  const { stores } = useNovuContext();
  const [notifications, setNotifications] = useState<Map<string, IMessage[]>>(new Map());
  const [page, setPage] = useState<Map<string, number>>(new Map([['general', 0]]));
  const [hasNextPage, setHasNextPage] = useState<Map<string, boolean>>(new Map([['general', true]]));
  const [fetching, setFetching] = useState<boolean>(false);
  const { token } = useContext<IAuthContext>(AuthContext);

  useEffect(() => {
    if (!api?.isAuthenticated || !token) return;

    fetchPage(0);
  }, [api?.isAuthenticated, token]);

  async function fetchPage(pageToFetch: number, isRefetch = false, storeId?: string) {
    setFetching(true);

    const newNotifications = await api.getNotificationsList(pageToFetch, getStoreQuery(storeId));

    if (newNotifications?.length < 10) {
      setHasNextPage(hasNextPage.set(storeId, false));
    } else {
      hasNextPage.set(storeId, true);
    }

    if (!page.has(storeId)) {
      page.set(storeId, 0);
    }

    if (isRefetch) {
      setNotifications(notifications.set(storeId, [...newNotifications]));
    } else {
      setNotifications(notifications.set(storeId, [...(notifications.get(storeId) || []), ...newNotifications]));
    }

    setFetching(false);
  }

  async function fetchNextPage(storeId?: string) {
    if (!hasNextPage.get(storeId)) return;

    const nextPage = page.get(storeId) + 1;
    setPage(page.set(storeId, nextPage));

    await fetchPage(nextPage, false, storeId);
  }

  async function markAsSeen(messageId: string): Promise<IMessage> {
    return await api.markMessageAsSeen(messageId);
  }

  async function updateAction(
    messageId: string,
    actionButtonType: ButtonTypeEnum,
    status: MessageActionStatusEnum,
    payload?: Record<string, unknown>,
    storeId?: string
  ) {
    await api.updateAction(messageId, actionButtonType, status, payload);

    notifications.set(
      storeId,
      notifications.get(storeId).map((message) => {
        if (message._id === messageId) {
          message.cta.action.status = MessageActionStatusEnum.DONE;
        }

        return message;
      })
    );

    setNotifications(notifications);
  }

  async function refetch(storeId?: string) {
    await fetchPage(0, true, storeId);
  }

  function getStoreQuery(storeId: string) {
    return stores.find((store) => store.storeId === storeId)?.query;
  }

  return (
    <NotificationsContext.Provider
      value={{ notifications, fetchNextPage, hasNextPage, fetching, markAsSeen, updateAction, refetch }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
