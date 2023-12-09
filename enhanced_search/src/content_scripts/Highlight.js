function doHighlight(currentMatches, currentMatchIndex) {
  const markInstance = new Mark(document.body);
  markInstance.unmark();

  if (!currentMatches?.length || currentMatchIndex == null) {
    return;
  }

  currentMatches.forEach((match, i) => {
    markInstance.mark(match, {
      separateWordSearch: false,
      acrossElements: true,
      className: i === currentMatchIndex ? 'current-match' : 'highlighted-text',
      done: () => {
        if (i === currentMatchIndex) {
          const element = document.getElementsByClassName('current-match')[0];

          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      },
    });
  });
}
