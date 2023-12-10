import {useState, useEffect} from 'react';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {MemoryVectorStore} from 'langchain/vectorstores/memory';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {OpenAIEmbeddings} from 'langchain/embeddings/openai';

import debounce from 'lodash/debounce';

const doSimilaritySearch = (query: string, vectorStore: MemoryVectorStore) => {
  return vectorStore.similaritySearchWithScore(query, 50).then((result) => {
    return result
      .filter((match) => match[1] > 0.8)
      .toSorted((match) => {
        const lines = match[0].metadata.loc.lines;
        return lines.from + lines.to;
      })
      .map((match) => match[0].pageContent);
  });
};

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: '',
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 15,
  chunkOverlap: 0,
  lengthFunction: (text) => text.split(/[ \s\t\n]/).length,
});

const App: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [currentMatchIndex, setCurrentMatch] = useState(0);

  // TODO: Change to array of matches.
  const [currentMatches, setCurrentMatches] = useState<string[]>([]);
  const [vectorStore, setVectorStore] = useState(
    new MemoryVectorStore(embeddings)
  );

  useEffect(() => {
    async function insertHighlightCSS() {
      const currentTabId = (await chrome.tabs.query({active: true}))?.[0]?.id;
      chrome.scripting.insertCSS({
        css: 'mark.current-match { background-color: #FFB300 }',
        target: {tabId: currentTabId ?? -1},
      });
    }

    insertHighlightCSS();
  }, []);

  useEffect(() => {
    async function getPageContent() {
      const currentTabId = (await chrome.tabs.query({active: true}))?.[0]?.id;
      const data = (
        await chrome.scripting.executeScript({
          func: () => document.body.innerText,
          target: {tabId: currentTabId ?? -1},
        })
      )?.[0]?.result;
      setVectorStore(
        await MemoryVectorStore.fromDocuments(
          await splitter.createDocuments([data]),
          embeddings
        )
      );
    }

    getPageContent();
  }, []);

  // TODO: pass array of matches.
  useEffect(() => {
    async function highlightWord() {
      const currentTabId = (await chrome.tabs.query({active: true}))?.[0]?.id;
      chrome.scripting.executeScript({
        func: (currentMatches, currentMatchIndex) =>
          doHighlight(currentMatches, currentMatchIndex),
        target: {tabId: currentTabId ?? -1},
        // @ts-ignore (TS insists args has to be empty)
        args: [currentMatches, currentMatchIndex],
      });
    }

    highlightWord();
  }, [currentMatches, currentMatchIndex]);

  useEffect(() => {
    async function similaritySearch() {
      if (!searchText || vectorStore.memoryVectors.length === 0) {
        return [];
      }
      setCurrentMatches(await doSimilaritySearch(searchText, vectorStore));
      setCurrentMatch(0);
    }

    similaritySearch();
  }, [searchText]);

  const incrementMatch = () => {
    if (currentMatchIndex === currentMatches.length - 1) {
      setCurrentMatch(0);
    } else {
      setCurrentMatch(currentMatchIndex + 1);
    }
  };

  const decrementMatch = () => {
    if (currentMatchIndex === 0) {
      setCurrentMatch(currentMatches.length - 1);
    } else {
      setCurrentMatch(currentMatchIndex - 1);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (currentMatches.length > 0) {
      if (event.code === 'Enter' && event.shiftKey) {
        decrementMatch();
      } else if (event.code === 'Enter') {
        incrementMatch();
      }
    }
  };

  return (
    <Paper
      component="form"
      onKeyDown={handleKeyDown}
      // Otherwise page will refresh when "Enter" is pressed.
      onSubmit={(event) => event.preventDefault()}
      sx={{
        p: '2px 4px',
        display: 'flex',
        alignItems: 'center',
        width: 400,
        minHeight: 42,
      }}>
      <SearchIcon />
      <InputBase
        sx={{ml: 1, mr: 1.5, flex: 1}}
        placeholder="Search"
        inputProps={{'aria-label': 'search'}}
        onChange={debounce((e) => setSearchText(e.target.value), 500)}
        endAdornment={
          <InputAdornment position="end">
            {searchText && (
              <span>
                {currentMatches.length > 0 ? currentMatchIndex + 1 : 0}/
                {currentMatches.length}
              </span>
            )}
            <IconButton
              aria-label="previous-search-result"
              size="small"
              edge="end"
              disabled={currentMatches.length <= 0}
              onClick={decrementMatch}>
              <KeyboardArrowUpIcon />
            </IconButton>
            <IconButton
              aria-label="next-search-result"
              size="small"
              edge="start"
              disabled={currentMatches.length <= 0}
              onClick={incrementMatch}>
              <KeyboardArrowDownIcon />
            </IconButton>
          </InputAdornment>
        }
      />
    </Paper>
  );
};

export default App;
