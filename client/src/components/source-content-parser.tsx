import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SourceContentParserProps {
  content: string;
}

export function SourceContentParser({ content }: SourceContentParserProps) {
  // Parse and render content with source attribution
  const parseSourceContent = (content: string) => {
    // Regular expression to match [TRANSCRIPT] and [WEBSITE] tags
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
      
      // Add sourced content
      parts.push({
        text: match[2],
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
          if (part.source === 'transcript') {
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <span 
                    className="border-b-2 border-dotted border-blue-500 hover:bg-blue-50 cursor-help"
                    dangerouslySetInnerHTML={{ __html: part.text }}
                  />
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
                  <span 
                    className="border-b-2 border-dotted border-green-500 hover:bg-green-50 cursor-help"
                    dangerouslySetInnerHTML={{ __html: part.text }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sourced from website analysis</p>
                </TooltipContent>
              </Tooltip>
            );
          } else {
            return (
              <span 
                key={index} 
                dangerouslySetInnerHTML={{ __html: part.text }}
              />
            );
          }
        })}
      </div>
    </TooltipProvider>
  );
}