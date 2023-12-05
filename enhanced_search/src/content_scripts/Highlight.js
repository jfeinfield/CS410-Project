function doHighlight(searchText, currentMatch) {
  const markInstance = new Mark(document.body);
  markInstance.unmark();
  
  if (!searchText || currentMatch == null) {
    return;
  }

  markInstance.mark(searchText, {
    separateWordSearch: false,
    acrossElements: true,
    className: 'highlighted-text',
    done: () => {
      const elements = document.getElementsByClassName('highlighted-text');
      if (elements.length) {
        for (let i = 0; i < elements.length; i++) {
          if (i === currentMatch) {
            elements[i].classList.add('current-match');
          } else {
            elements[i].classList.remove('current-match');
          }
        }
        elements[currentMatch].scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    },
  });
}
