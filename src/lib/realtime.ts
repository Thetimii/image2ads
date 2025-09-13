import { createClient } from "./supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export class RealtimeManager {
  private static instance: RealtimeManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private supabase = createClient();

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  subscribeToJobs(
    userId: string,
    onUpdate: (payload: unknown) => void,
    onError?: (error: unknown) => void
  ): string {
    const channelId = `jobs-${userId}`;

    // Remove existing channel if it exists
    this.unsubscribe(channelId);

    const channel = this.supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Job realtime update:", payload);
          onUpdate(payload);
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to job updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("Channel error");
          onError?.(new Error("Channel subscription error"));
        }
      });

    this.channels.set(channelId, channel);
    return channelId;
  }

  subscribeToImages(
    folderId: string,
    userId: string,
    onUpdate: (payload: unknown) => void,
    onError?: (error: unknown) => void
  ): string {
    const channelId = `images-${folderId}`;

    // Remove existing channel if it exists
    this.unsubscribe(channelId);

    const channel = this.supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "images",
          filter: `folder_id=eq.${folderId} AND user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Image realtime update:", payload);
          onUpdate(payload);
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Successfully subscribed to image updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("Channel error");
          onError?.(new Error("Channel subscription error"));
        }
      });

    this.channels.set(channelId, channel);
    return channelId;
  }

  unsubscribe(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelId);
      console.log(`Unsubscribed from channel: ${channelId}`);
    }
  }

  unsubscribeAll(): void {
    this.channels.forEach((channel, channelId) => {
      this.supabase.removeChannel(channel);
      console.log(`Unsubscribed from channel: ${channelId}`);
    });
    this.channels.clear();
  }
}

export const realtimeManager = RealtimeManager.getInstance();
