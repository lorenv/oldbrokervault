import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ReactMarkdown from 'react-markdown';

interface SourceContentParserProps {
  content: string;
}

export function SourceContentParser({ content }: SourceContentParserProps) {
  // Parse and render content with source attribution
  const parseSourceContent = (content: string) => {
    // Regular expression to match [TRANSCRIPT] and [WEBSITE] tags with non-greedy matching
    const sourceRegex = /\[(TRANSCRIPT|WEBSITE)\](.*?)\[\/\1\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = sourceRegex.exec(content)) !== null) {
      // Add unsourced content before the match
      if (match.index > lastIndex) {
        parts.push({
          text: content.slice(lastIndex, match.index),
          source: null
        });
      }
      
      // Add sourced content (clean the matched text)
      parts.push({
        text: match[2].trim(),
        source: match[1].toLowerCase()
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining content after the last match
    if (lastIndex < content.length) {
      parts.push({
        text: content.slice(lastIndex),
        source: null
      });
    }

    return parts;
  };

  const parts = parseSourceContent(content);
  
  return (
    <TooltipProvider>
      <div>
        {parts.map((part, index) => {
          if (!part.text.trim()) return null;
          
          if (part.source === 'transcript') {
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <span className="border-b-2 border-dotted border-blue-500 hover:bg-blue-50 cursor-help">
                    <ReactMarkdown 
                      components={{
                        ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        p: ({ children }) => <span>{children}</span>, // Inline p tags to avoid nested p elements
                        code: ({ children }) => <span>{children}</span>,
                        pre: ({ children }) => <span>{children}</span>
                      }}
                    >
                      {part.text}
                    </ReactMarkdown>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sourced from notes or transcript</p>
                </TooltipContent>
              </Tooltip>
            );
          } else if (part.source === 'website') {
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <span className="border-b-2 border-dotted border-green-500 hover:bg-green-50 cursor-help">
                    <ReactMarkdown 
                      components={{
                        ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        p: ({ children }) => <span>{children}</span>, // Inline p tags to avoid nested p elements
                        code: ({ children }) => <span>{children}</span>,
                        pre: ({ children }) => <span>{children}</span>
                      }}
                    >
                      {part.text}
                    </ReactMarkdown>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sourced from website analysis</p>
                </TooltipContent>
              </Tooltip>
            );
          } else {
            return (
              <ReactMarkdown 
                key={index}
                components={{
                  ul: ({ children }) => <ul className="list-disc pl-4">{children}</ul>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  code: ({ children }) => <span>{children}</span>,
                  pre: ({ children }) => <span>{children}</span>
                }}
              >
                {part.text}
              </ReactMarkdown>
            );
          }
        })}
      </div>
    </TooltipProvider>
  );
}