import {useState, useEffect, useCallback} from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {MemoryVectorStore} from 'langchain/vectorstores/memory';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {OpenAIEmbeddings} from 'langchain/embeddings/openai';

import debounce from 'lodash/debounce';
import filter from 'lodash/fp/filter';
import flow from 'lodash/fp/flow';
import map from 'lodash/fp/map';
import sortBy from 'lodash/fp/sortBy';
import uniq from 'lodash/fp/uniq';

import './App.css';

// Get word embeddings to be used for cosine similarity search between search query and documents.
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: '',
});

// Initialize text splitter to split text into chunks of at most 20 words.
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 20,
  chunkOverlap: 0,
  lengthFunction: (text) => text.split(/[ \s\t\n]/).length,
});

// Loading state while the page is being split, word embeddings computed, and stored in the vector store.
const inputPlaceholders: Record<number, string> = {
  0: 'Indexing Page...',
  1: 'Search',
  2: 'Error Indexing Page',
};

const App: React.FC = () => {
  // The search query.
  const [searchText, setSearchText] = useState('');

  // The index of the current match in the array of matches.
  const [currentMatchIndex, setCurrentMatch] = useState(0);

  // The array of matches from the similarity search.
  const [currentMatches, setCurrentMatches] = useState<string[]>([]);
  
  // The vector store containing the word embeddings of the page.
  const [vectorStore, setVectorStore] = useState(
    new MemoryVectorStore(embeddings)
  );
  
  // 0 - Loading, 1 - Loaded, 2 - Error / No Vectors
  const [vectorStoreStatus, setVectorStoreStatus] = useState(0);
  
  // The minimum cosine similarity between the search query and a document for it to be considered a match.
  const [similaritySetting, setSimilaritySetting] = useState(0.8);

  /*
   * Similarity search function to get matches in the page. Results are filtered by `similaritySetting`, and sorted by
   * their position in the page.
   */
  const doSimilaritySearch = useCallback(
    (query: string, vectorStore: MemoryVectorStore) => {
      return vectorStore.similaritySearchWithScore(query, 50).then((result) => {
        return flow(
          filter((match: any) => match[1] > similaritySetting),
          sortBy((match) => {
            const lines = match[0].metadata.loc.lines;
            return lines.from + lines.to;
          }),
          map('[0].pageContent'),
          uniq
        )(result);
      });
    },
    [similaritySetting]
  );

  // On first render of the extension, insert the CSS for match highlighting into the target page.
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

  /*
   * On first render of the extension, get the page content, split it into chunks, compute the word embeddings for each
   * chunk, and store it in the vector store. When it completes, update the vector store status.
   */
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
        ).then((store) => {
          if (store.memoryVectors.length === 0) {
            setVectorStoreStatus(2);
          } else {
            setVectorStoreStatus(1);
          }
          return store;
        })
      );
    }

    getPageContent();
  }, []);

  // Highlight all matches in the target page. Calls `doHighlight` from `../content_scripts/Highlight.js`.
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

  // Perform similarity search when the search query changes.
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

  // Increment the `currentMatchIndex`, capping at the length of `currentMatches`.
  const incrementMatch = () => {
    if (currentMatchIndex === currentMatches.length - 1) {
      setCurrentMatch(0);
    } else {
      setCurrentMatch(currentMatchIndex + 1);
    }
  };

  // Decrement the `currentMatchIndex`, capping at 0.
  const decrementMatch = () => {
    if (currentMatchIndex === 0) {
      setCurrentMatch(currentMatches.length - 1);
    } else {
      setCurrentMatch(currentMatchIndex - 1);
    }
  };

  // Handle keyboard shortcuts for incrementing and decrementing matches.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (currentMatches.length > 0) {
      if (event.code === 'Enter' && event.shiftKey) {
        decrementMatch();
      } else if (event.code === 'Enter') {
        incrementMatch();
      }
    }
  };

  // Set up dropdown menu for adjusting similarity setting.
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleButtonClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = (similarity?: number) => {
    return () => {
      if (similarity) {
        setSimilaritySetting(similarity);
      }
      setAnchorEl(null);
    };
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
        width: 450,
        minHeight: 42,
      }}>
      <SearchIcon sx={{pl: '4px'}} />
      <InputBase
        sx={{ml: 1, mr: 0, flex: 1}}
        placeholder={inputPlaceholders[vectorStoreStatus]}
        disabled={vectorStoreStatus !== 1}
        inputProps={{'aria-label': 'search'}}
        onChange={debounce((e) => setSearchText(e.target.value), 500)}
        endAdornment={
          <InputAdornment position="end">
            {vectorStoreStatus === 0 && <CircularProgress size={24} />}
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
      <div>
        <Tooltip
          title="Adjust level of similarity to filter results by"
          placement="left">
          <IconButton
            aria-controls={open ? 'fade-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            onClick={handleButtonClick}>
            <MenuIcon />
          </IconButton>
        </Tooltip>
        <Menu
          MenuListProps={{
            sx: {p: 0},
            'aria-labelledby': 'fade-button',
          }}
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose()}
          anchorOrigin={{
            vertical: 'top',
            horizontal: -275,
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}>
          <Stack direction="row">
            <MenuItem
              onClick={handleMenuClose(0.8)}
              selected={similaritySetting === 0.8}>
              High
            </MenuItem>
            <MenuItem
              onClick={handleMenuClose(0.7)}
              selected={similaritySetting === 0.7}>
              Medium
            </MenuItem>
            <MenuItem
              onClick={handleMenuClose(0.6)}
              selected={similaritySetting === 0.6}>
              Low
            </MenuItem>
            <MenuItem
              onClick={handleMenuClose(0)}
              selected={similaritySetting === 0}>
              All
            </MenuItem>
          </Stack>
        </Menu>
      </div>
    </Paper>
  );
};

export default App;
