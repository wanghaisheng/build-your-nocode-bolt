"use client"
import type { Message } from 'ai';
import React from 'react';
import { cn } from '@/lib/utils';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DotsThreeOutline } from '@phosphor-icons/react';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [] } = props;

  return (
    <div id={id} ref={ref} className={props.className}>
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content, data } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;

            return (
              <div
                key={index}
                className={cn('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
                  'bg-white/5  backdrop-blur-sm border border-white/10': isUserMessage || !isStreaming || (isStreaming && !isLast),
                  'bg-gradient-to-b from-white/5 from-30% to-transparent':
                    isStreaming && isLast,
                  'mt-4': !isFirst,
                })}
              >
                {isUserMessage && (
                  <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden rounded-full shrink-0 self-start">
                    <Avatar className="h-full w-full ">
                        <AvatarImage src={""} alt={""} />
                        <AvatarFallback className="">BN</AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="grid grid-col-1 w-full">
                  {isUserMessage ? <UserMessage content={content} data={data} /> : <AssistantMessage content={content} />}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && (
        <DotsThreeOutline className="text-center w-full text-accent-foreground i-svg-spinners:3-dots-fade text-4xl mt-4"></DotsThreeOutline>
      )}
    </div>
  );
});