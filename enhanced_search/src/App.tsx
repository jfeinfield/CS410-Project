import { useState, useEffect, useMemo } from 'react';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';

import debounce from 'lodash/debounce';

const App: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [pageContent, setPageContent] = useState('');

  useEffect(() => {
    async function getPageContent() {
      const currentTabId = (await chrome.tabs.query({ active: true}))?.[0]?.id;
      const data = (await chrome.scripting.executeScript({
        func: () => document.body.innerText,
        target: { tabId: currentTabId ?? -1 },
      }))?.[0]?.result;
      setPageContent(data);
    }

    getPageContent();
  });

  const totalMatches = useMemo(() => {
    return pageContent.match(new RegExp(searchText, 'gi'))?.length ?? 0;
  }, [pageContent, searchText]);


  return (
    <Paper
      component="form"
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
        multiline={true}
        maxRows={5}
        onChange={debounce((e) => setSearchText(e.target.value), 500)}
        endAdornment={
          searchText && (
            <InputAdornment position="end">
              {currentMatch}/{totalMatches}
            </InputAdornment>
          )
        }
      />
    </Paper>
  );
};

export default App;
