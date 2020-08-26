import React from "react";

// See https://allthingssmitty.com/2016/09/12/checking-if-font-awesome-loaded/
const IsFontAwesomeLoaded = (version) => {
  const prefix = version === 4 ? "fa" : "fas";
  const fontNames =
    version === 4
      ? ["FontAwesome", '"FontAwesome"']
      : ['"Font Awesome 5 Free"', '"Font Awesome 5 Pro"'];
  let FontAwesomeLoaded = false;
  const span = document.createElement("span");

  span.className = prefix;
  span.style.display = "none";
  document.body.insertBefore(span, document.body.firstChild);

  const css = (element, property) =>
    window.getComputedStyle(element, null).getPropertyValue(property);

  if (!fontNames.includes(css(span, "font-family"))) {
    console.warn(
      `Font Awesome ${version} was not detected but Font Awesome ${version} icons have been requested for \`react-object-list\``
    );
  } else {
    FontAwesomeLoaded = true;
  }
  document.body.removeChild(span);
  return FontAwesomeLoaded;
};

const FontAwesomeIcons = (majorVersion = 4) => {
  switch (majorVersion) {
    case 4:
      IsFontAwesomeLoaded(4);
      return {
        File: <i className="fa fa-file" aria-hidden="true" />,
        Image: <i className="fa fa-file-image" aria-hidden="true" />,
        Video: <i className="fa fa-file-video" aria-hidden="true" />,
        Audio: <i className="fa fa-file-audio" aria-hidden="true" />,
        Archive: <i className="fa fa-file-archive" aria-hidden="true" />,
        Word: <i className="fa fa-file-word" aria-hidden="true" />,
        Excel: <i className="fa fa-file-excel" aria-hidden="true" />,
        PowerPoint: <i className="fa fa-file-powerpoint" aria-hidden="true" />,
        Text: <i className="fa fa-file-text" aria-hidden="true" />,
        PDF: <i className="fa fa-file-pdf" aria-hidden="true" />,
        Rename: <i className="fa fa-i-cursor" aria-hidden="true" />,
        Folder: <i className="fa fa-folder-o" aria-hidden="true" />,
        FolderFilled: <i className="fa fa-folder" aria-hidden="true" />,
        FolderOpen: <i className="fa fa-folder-open-o" aria-hidden="true" />,
        FolderOpenFilled: (
          <i className="fa fa-folder-open" aria-hidden="true" />
        ),
        Delete: <i className="fa fa-trash-o" aria-hidden="true" />,
        Loading: (
          <i className="fa fa-circle-o-notch fa-spin" aria-hidden="true" />
        ),
        Download: <i className="fa fa-download" aria-hidden="true" />,
      };
    case 5:
      IsFontAwesomeLoaded(5);
      return {
        File: <i className="fas fa-file"></i>,
        Image: <i className="fas fa-file-image"></i>,
        Video: <i className="fas fa-file-video"></i>,
        Audio: <i className="fas fa-file-audio"></i>,
        Archive: <i className="fas fa-file-archive"></i>,
        Word: <i className="fas fa-file-word"></i>,
        Excel: <i className="fas fa-file-excel"></i>,
        PowerPoint: <i className="fas fa-file-powerpoint"></i>,
        Text: <i className="fas fa-file-alt"></i>,
        PDF: <i className="fas fa-file-pdf"></i>,
        Rename: <i className="fas fa-remove-format"></i>,
        Folder: <i className="fas fa-folder"></i>,
        FolderFilled: <i className="fas fa-folder"></i>,
        FolderPlus: <i className="fas fa-folder-plus"></i>,
        FolderOpen: <i className="fas fa-folder-open"></i>,
        Delete: <i className="fas fa-trash"></i>,
        Loading: (
          <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
        ),
        Download: <i className="fas fa-file-download"></i>,
      };
    default:
      console.warn(
        `Could not find config for version ${majorVersion}`,
        "Accepted versions are: 4, 5",
        "Please make an issue in `react-object-list` to fix this."
      );
  }
};

export default FontAwesomeIcons;
