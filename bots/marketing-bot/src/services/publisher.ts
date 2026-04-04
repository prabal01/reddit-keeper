import { config } from "../config/env.js";
import { Publisher, PublishResult } from "../types.js";

/**
 * Buffer API Publisher for Twitter/X
 */
export class BufferPublisher implements Publisher {
  private apiKey: string;
  private profileId: string;

  constructor() {
    this.apiKey = config.buffer.apiKey;
    this.profileId = config.buffer.profileId;
  }

  async publish(content: string): Promise<PublishResult> {
    try {
      const response = await fetch("https://api.buffer.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: `
            mutation CreatePost($input: CreatePostInput!) {
              createPost(input: $input) {
                ... on PostActionSuccess {
                  post {
                    id
                  }
                }
                ... on MutationError {
                  message
                }
              }
            }
          `,
          variables: {
            input: {
              channelId: this.profileId,
              text: content,
              schedulingType: "automatic",
              mode: "shareNow",
            }
          }
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Buffer API error: ${response.status} - ${errorBody}` };
      }

      const data = (await response.json()) as any;
      if (data.errors && data.errors.length > 0) {
        return { success: false, error: data.errors[0].message };
      }

      const createData = data.data?.createPost;
      if (createData?.message) return { success: false, error: createData.message };

      return {
        success: true,
        url: createData?.post?.id ? `https://buffer.com/post/${createData.post.id}` : undefined,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
