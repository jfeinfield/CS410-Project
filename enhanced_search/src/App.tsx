import {useState, useEffect, useMemo} from 'react';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import debounce from 'lodash/debounce';

const App: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [pageContent, setPageContent] = useState('');

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
      setPageContent(data);
    }

    getPageContent();
  });

  useEffect(() => {
    async function highlightWord() {
      const currentTabId = (await chrome.tabs.query({active: true}))?.[0]?.id;
      chrome.scripting.executeScript({
        func: (searchText, currentMatch) =>
          doHighlight(searchText, currentMatch),
        target: {tabId: currentTabId ?? -1},
        // @ts-ignore (TS insists args has to be empty)
        args: [searchText, currentMatch],
      });
    }

    highlightWord();
  }, [searchText, currentMatch]);

  const totalMatches = useMemo(() => {
    return searchText
      ? pageContent.match(new RegExp(searchText, 'gi'))?.length ?? 0
      : 0;
  }, [pageContent, searchText]);

  const incrementMatch = () => {
    if (currentMatch === totalMatches - 1) {
      setCurrentMatch(0);
    } else {
      setCurrentMatch(currentMatch + 1);
    }
  };

  const decrementMatch = () => {
    if (currentMatch === 0) {
      setCurrentMatch(totalMatches - 1);
    } else {
      setCurrentMatch(currentMatch - 1);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (totalMatches > 0) {
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
                {totalMatches > 0 ? currentMatch + 1 : 0}/{totalMatches}
              </span>
            )}
            <IconButton
              aria-label="previous-search-result"
              size="small"
              edge="end"
              disabled={totalMatches <= 0}
              onClick={decrementMatch}>
              <KeyboardArrowUpIcon />
            </IconButton>
            <IconButton
              aria-label="next-search-result"
              size="small"
              edge="start"
              disabled={totalMatches <= 0}
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
