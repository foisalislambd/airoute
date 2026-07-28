// @ts-nocheck
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../packages/web/source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "../../../docs", {}, {});