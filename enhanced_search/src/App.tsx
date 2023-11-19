import React from 'react';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';

import debounce from 'lodash/debounce';

const App: React.FC = () => {
  const [searchText, setSearchText] = React.useState('');
  const [currentMatch, setCurrentMatch] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);

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
