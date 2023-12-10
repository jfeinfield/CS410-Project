function doHighlight(currentMatches, currentMatchIndex) {
  const markInstance = new Mark(document.body);
  
  // Remove previous highlights.
  markInstance.unmark();

  if (!currentMatches?.length || currentMatchIndex == null) {
    return;
  }

  currentMatches.forEach((match, i) => {
    // Highlight each of the matches, with the current match highlighted orange, and the rest highlighted yellow.
    markInstance.mark(match, {
      separateWordSearch: false,
      acrossElements: true,
      className: i === currentMatchIndex ? 'current-match' : 'highlighted-text',
      done: () => {
        // Scroll to the current match.
        if (i === currentMatchIndex) {
          const element = document.getElementsByClassName('current-match')[0];

          element && element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      },
    });
  });
}
