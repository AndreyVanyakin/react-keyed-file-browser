import PropTypes from "prop-types";
import React, { Component, PureComponent } from "react";
// drag and drop
import HTML5Backend from "react-dnd-html5-backend";
import { DragDropContext } from "react-dnd";

// default components (most overridable)
import { DefaultDetail } from "./details";
import { DefaultFilter } from "./filters";

// default renderers
import { TableHeader } from "./headers";
import { TableFile } from "./files";
import { TableFolder } from "./folders";
import {
  DefaultConfirmDeletion,
  MultipleConfirmDeletion,
} from "./confirmations";

// default processors
import { GroupByFolder } from "./groupers";
import { SortByName } from "./sorters";

import { isFolder } from "./utils";
import { DefaultAction } from "./actions";
import { includes } from "lodash";

const SEARCH_RESULTS_PER_PAGE = 20;
const regexForNewFolderOrFileSelection = /.*\/__new__[/]?$/gm;

function getItemProps(file, browserProps) {
  return {
    key: `file-${file.key}`,
    fileKey: file.key,
    isSelected: browserProps.selection.includes(file.key),
    isOpen: file.key in browserProps.openFolders || browserProps.nameFilter,
    isRenaming:
      browserProps.activeAction === "rename" &&
      browserProps.actionTargets.includes(file.key),
    isDeleting:
      browserProps.activeAction === "delete" &&
      browserProps.actionTargets.includes(file.key),
    isDraft: !!file.draft,
  };
}

class RawFileBrowser extends Component {
  static propTypes = {
    files: PropTypes.arrayOf(
      PropTypes.shape({
        file_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
          .isRequired,
        key: PropTypes.string.isRequired,
        status: PropTypes.oneOf(["encrypted", "unencrypted"]),
        sharer: PropTypes.string,
        modified: PropTypes.number,
        created: PropTypes.number,
        size: PropTypes.number,
      })
    ).isRequired,
    actions: PropTypes.node,
    showActionBar: PropTypes.bool.isRequired,
    canFilter: PropTypes.bool.isRequired,
    showFoldersOnFilter: PropTypes.bool,
    noFilesMessage: PropTypes.string,

    group: PropTypes.func.isRequired,
    sort: PropTypes.func.isRequired,

    icons: PropTypes.shape({
      Folder: PropTypes.element,
      FolderOpen: PropTypes.element,
      File: PropTypes.element,
      FolderPlus: PropTypes.element,
      Image: PropTypes.element,
      Video: PropTypes.element,
      Audio: PropTypes.element,
      Word: PropTypes.element,
      Excel: PropTypes.element,
      Archive: PropTypes.element,
      Text: PropTypes.element,
      PDF: PropTypes.element,
      Delete: PropTypes.element,
      Rename: PropTypes.element,
      Loading: PropTypes.element,
      Download: PropTypes.element,
      Search: PropTypes.element,
      Lock: PropTypes.element,
    }),

    nestChildren: PropTypes.bool.isRequired,
    renderStyle: PropTypes.oneOf(["list", "table"]).isRequired,

    startOpen: PropTypes.bool.isRequired, // TODO: remove?

    headerRenderer: PropTypes.func,
    headerRendererProps: PropTypes.object,
    filterRenderer: PropTypes.func,
    filterRendererProps: PropTypes.object,
    fileRenderer: PropTypes.func,
    fileRendererProps: PropTypes.object,
    folderRenderer: PropTypes.func,
    folderRendererProps: PropTypes.object,
    detailRenderer: PropTypes.func,
    detailRendererProps: PropTypes.object,
    actionRenderer: PropTypes.func,
    confirmDeletionRenderer: PropTypes.func,
    confirmMultipleDeletionRenderer: PropTypes.func,

    onSelectionChange: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onCreateFiles: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onCreateFolder: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onMoveFile: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onMoveFolder: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onRenameFile: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onRenameFolder: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onDeleteFile: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onDeleteFolder: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
    onDownloadFile: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),

    onSelect: PropTypes.func,
    onSelectFile: PropTypes.func,
    onSelectFolder: PropTypes.func,

    onPreviewOpen: PropTypes.func,
    onPreviewClose: PropTypes.func,

    onFolderOpen: PropTypes.func,
    onFolderClose: PropTypes.func,
  };

  static defaultProps = {
    showActionBar: true,
    canFilter: true,
    showFoldersOnFilter: false,
    noFilesMessage: "No files.",

    group: GroupByFolder,
    sort: SortByName,

    nestChildren: false,
    renderStyle: "table",

    startOpen: false,

    headerRenderer: TableHeader,
    headerRendererProps: {},
    filterRenderer: DefaultFilter,
    filterRendererProps: {},
    fileRenderer: TableFile,
    fileRendererProps: {},
    folderRenderer: TableFolder,
    folderRendererProps: {},
    detailRenderer: DefaultDetail,
    detailRendererProps: {},
    actionRenderer: DefaultAction,

    icons: {},

    onSelect: (fileOrFolder) => {}, // Always called when a file or folder is selected
    onSelectFile: (file) => {}, //    Called after onSelect, only on file selection
    onSelectFolder: (folder) => {}, //    Called after onSelect, only on folder selection
    onSelectionChange: (selection) => {}, // Pass selection state up
    onPreviewOpen: (file) => {}, // File opened
    onPreviewClose: (file) => {}, // File closed

    onFolderOpen: (folder) => {}, // Folder opened
    onFolderClose: (folder) => {}, // Folder closed

    isShouldInvokeCreateFolder: false,
    isShouldFireRename: false,
  };

  state = {
    openFolders: {},
    selection: [], // should be the file ids, not keys. If folder => then all children files
    activeAction: null,
    actionTargets: [],

    nameFilter: "",
    searchResultsShown: SEARCH_RESULTS_PER_PAGE,

    previewFile: null,

    addFolder: null,
  };

  componentDidMount() {
    if (this.props.renderStyle === "table" && this.props.nestChildren) {
      console.warn(
        "Invalid settings: Cannot nest table children in file browser"
      );
    }

    window.addEventListener("click", this.handleGlobalClick);
  }

  componentDidUpdate() {
    // console.log("RKFB CDU");
    this.onSelectionChange();
  }

  componentWillUnmount() {
    // console.log("RKFB CWU");
    window.removeEventListener("click", this.handleGlobalClick);
  }

  getFile = (key) => this.props.files.find((f) => f.key === key);

  // Define if we should show shared column in Folder, File renderers
  isShouldShowShared = () => {
    // console.log("Input files", this.props.files);
    const filesWithSharedPresent = this.props.files.filter((fileObj) =>
      includes(Object.keys(fileObj), "sharer")
    );
    const isShould = filesWithSharedPresent.length > 0;
    // console.log(
    //   isShould ? "We should see shared" : "We should NOT see shared",
    //   filesWithSharedPresent
    // );
    return isShould;
  };

  // Define if we should whos is the consumer of shared files with
  isShouldShowSharedWithWhom = () => {
    // console.log("Input files", this.props.files);
    const filesWithSharedPresent = this.props.files.filter((fileObj) =>
      includes(Object.keys(fileObj), "shared_with")
    );
    const isShould = filesWithSharedPresent.length > 0;
    // console.log(
    //   isShould ? "We should see shared" : "We should NOT see shared",
    //   filesWithSharedPresent
    // );
    return isShould;
  };

  // item manipulation
  createFiles = (files, prefix) => {
    this.setState(
      (prevState) => {
        const stateChanges = { selection: [] };
        if (prefix) {
          stateChanges.openFolders = {
            ...prevState.openFolders,
            [prefix]: true,
          };
        }
        return stateChanges;
      },
      () => {
        this.props.onCreateFiles(files, prefix);
      }
    );
  };

  // Disabled for Amera at the moment
  createFolder = (key) => {
    this.setState(
      {
        activeAction: null,
        actionTargets: [],
        selection: [key],
      },
      () => {
        this.props.onCreateFolder(key);
      }
    );
  };

  // Should work
  moveFile = (oldKey, newKey) => {
    this.setState(
      {
        activeAction: null,
        actionTargets: [],
        selection: [newKey],
      },
      () => {
        this.props.onMoveFile(oldKey, newKey);
      }
    );
  };

  // Should work
  moveFolder = (oldKey, newKey) => {
    this.setState(
      (prevState) => {
        const stateChanges = {
          activeAction: null,
          actionTargets: [],
          selection: [newKey],
        };
        if (oldKey in prevState.openFolders) {
          stateChanges.openFolders = {
            ...prevState.openFolders,
            [newKey]: true,
          };
        }
        return stateChanges;
      },
      () => {
        this.props.onMoveFolder(oldKey, newKey);
      }
    );
  };

  // Should work
  renameFile = (oldKey, newKey) => {
    this.setState(
      {
        activeAction: null,
        actionTargets: [],
        selection: [newKey],
      },
      () => {
        this.props.onRenameFile(oldKey, newKey);
      }
    );
  };

  // Should work
  renameFolder = (oldKey, newKey) => {
    this.setState(
      (prevState) => {
        const stateChanges = {
          activeAction: null,
          actionTargets: [],
        };
        if (prevState.selection[0].substr(0, oldKey.length) === oldKey) {
          stateChanges.selection = [
            prevState.selection[0].replace(oldKey, newKey),
          ];
        }
        if (oldKey in prevState.openFolders) {
          stateChanges.openFolders = {
            ...prevState.openFolders,
            [newKey]: true,
          };
        }
        return stateChanges;
      },
      () => {
        this.props.onRenameFolder(oldKey, newKey);
      }
    );
  };

  // Should work
  deleteFile = (keys) => {
    this.setState(
      {
        activeAction: null,
        actionTargets: [],
        selection: [],
      },
      () => {
        this.props.onDeleteFile(keys);
      }
    );
  };

  // Not using now
  deleteFolder = (key) => {
    this.setState(
      (prevState) => {
        const stateChanges = {
          activeAction: null,
          actionTargets: [],
          selection: [],
        };
        if (key in prevState.openFolders) {
          stateChanges.openFolders = { ...prevState.openFolders };
          delete stateChanges.openFolders[key];
        }
        return stateChanges;
      },
      () => {
        this.props.onDeleteFolder(key);
      }
    );
  };

  // Not using now
  downloadFile = (keys) => {
    this.setState(
      {
        activeAction: null,
        actionTargets: [],
      },
      () => {
        this.props.onDownloadFile(keys);
      }
    );
  };

  // browser manipulation
  beginAction = (action, ids) => {
    this.setState({
      activeAction: action,
      actionTargets: ids || [],
    });
  };

  endAction = () => {
    if (
      this.state.selection &&
      this.state.selection.length > 0 &&
      this.state.selection.filter((selection) =>
        selection.match(regexForNewFolderOrFileSelection)
      ).length > 0
    ) {
      this.setState({ selection: [] });
    }
    this.beginAction(null, null);
  };

  onSelectionChange = () => {
    this.props.onSelectionChange(this.state.selection);
  };

  select = (key, selectedType, ctrlKey, shiftKey) => {
    const { actionTargets } = this.state;
    const shouldClearState =
      actionTargets.length && !actionTargets.includes(key);
    const selected = this.getFile(key);

    let newSelection = [key];
    if (ctrlKey || shiftKey) {
      const indexOfKey = this.state.selection.indexOf(key);
      if (indexOfKey !== -1) {
        newSelection = [
          ...this.state.selection.slice(0, indexOfKey),
          ...this.state.selection.slice(indexOfKey + 1),
        ];
      } else {
        newSelection = [...this.state.selection, key];
      }
    }

    this.setState(
      (prevState) => ({
        selection: newSelection,
        actionTargets: shouldClearState ? [] : actionTargets,
        activeAction: shouldClearState ? null : prevState.activeAction,
      }),
      () => {
        this.props.onSelect(newSelection);

        if (selectedType === "file")
          this.props.onSelectFile(
            this.state.selection.map((key) => this.getFile(key))
          );
        if (selectedType === "folder") this.props.onSelectFolder(selected);
      }
    );
  };

  preview = (file) => {
    if (this.state.previewFile && this.state.previewFile.key !== file.key)
      this.closeDetail();

    this.setState(
      {
        previewFile: file,
      },
      () => {
        this.props.onPreviewOpen(file);
      }
    );
  };

  // Should be ok
  closeDetail = () => {
    this.setState(
      {
        previewFile: null,
      },
      () => {
        this.props.onPreviewClose(this.state.previewFile);
      }
    );
  };

  // Not used
  handleShowMoreClick = (event) => {
    event.preventDefault();
    this.setState((prevState) => ({
      searchResultsShown:
        prevState.searchResultsShown + SEARCH_RESULTS_PER_PAGE,
    }));
  };

  // Changes here
  toggleFolder = (folderKey) => {
    const isOpen = folderKey in this.state.openFolders;
    this.setState(
      (prevState) => {
        const stateChanges = {
          openFolders: { ...prevState.openFolders },
        };
        if (isOpen) {
          delete stateChanges.openFolders[folderKey];
        } else {
          stateChanges.openFolders[folderKey] = true;
        }
        return stateChanges;
      },
      () => {
        const callback = isOpen ? "onFolderClose" : "onFolderOpen";
        this.props[callback](this.getFile(folderKey));
      }
    );
  };

  openFolder = (folderKey) => {
    this.setState(
      (prevState) => ({
        openFolders: {
          ...prevState.openFolders,
          [folderKey]: true,
        },
      }),
      () => {
        this.props.onFolderOpen(this.getFile(folderKey));
      }
    );
  };

  // event handlers
  handleGlobalClick = (event) => {
    const inBrowser = !!(
      this.browserRef && this.browserRef.contains(event.target)
    );
    // TODO: updated old-to-new ref styles, but this ref was never set
    const inPreview = !!(
      this.previewRef && this.previewRef.contains(event.target)
    );

    if (!inBrowser && !inPreview) {
      this.setState({
        selection: [],
        actionTargets: [],
        activeAction: null,
      });
    }
  };
  handleActionBarRenameClick = (event) => {
    if (event) {
      event.preventDefault();
    }
    console.log(
      "Action bar rename triggered, the selection is",
      this.state.selection
    );
    // event.preventDefault();
    // Should check this
    this.beginAction("rename", this.state.selection);
  };
  // Not using this
  handleActionBarDeleteClick = (event) => {
    event.preventDefault();
    this.beginAction("delete", this.state.selection);
  };
  // Not using this
  handleActionBarAddFolderClick = () => {
    // event.preventDefault();
    if (this.state.activeAction === "createFolder") {
      return;
    }
    this.setState((prevState) => {
      let addKey = "";
      if (prevState.selection && prevState.selection.length > 0) {
        addKey += prevState.selection;
        if (addKey.substr(addKey.length - 1, addKey.length) !== "/") {
          addKey += "/";
        }
      }

      if (addKey !== "__new__/" && !addKey.endsWith("/__new__/"))
        addKey += "__new__/";
      const stateChanges = {
        actionTargets: [addKey],
        activeAction: "createFolder",
        selection: [addKey],
      };
      if (prevState.selection && prevState.selection.length > 0) {
        stateChanges.openFolders = {
          ...prevState.openFolders,
          [this.state.selection]: true,
        };
      }
      return stateChanges;
    });
  };
  // Not using this
  handleActionBarDownloadClick = (event) => {
    event.preventDefault();
    this.downloadFile(this.state.selection);
  };
  // ok
  updateFilter = (newValue) => {
    this.setState({
      nameFilter: newValue,
      searchResultsShown: SEARCH_RESULTS_PER_PAGE,
    });
  };

  getBrowserProps() {
    return {
      // browser config
      nestChildren: this.props.nestChildren,
      fileRenderer: this.props.fileRenderer,
      fileRendererProps: this.props.fileRendererProps,
      folderRenderer: this.props.folderRenderer,
      folderRendererProps: this.props.folderRendererProps,
      confirmDeletionRenderer: this.props.confirmDeletionRenderer,
      confirmMultipleDeletionRenderer: this.props
        .confirmMultipleDeletionRenderer,
      icons: this.props.icons,

      // browser state
      openFolders: this.state.openFolders,
      nameFilter: this.state.nameFilter,
      selection: this.state.selection,
      activeAction: this.state.activeAction,
      actionTargets: this.state.actionTargets,

      // browser manipulation
      select: this.select,
      openFolder: this.openFolder,
      toggleFolder: this.toggleFolder,
      beginAction: this.beginAction,
      endAction: this.endAction,
      preview: this.preview,

      // item manipulation
      createFiles: this.props.onCreateFiles ? this.createFiles : undefined,
      createFolder: this.props.onCreateFolder ? this.createFolder : undefined,
      renameFile: this.props.onRenameFile ? this.renameFile : undefined,
      renameFolder: this.props.onRenameFolder ? this.renameFolder : undefined,
      moveFile: this.props.onMoveFile ? this.moveFile : undefined,
      moveFolder: this.props.onMoveFolder ? this.moveFolder : undefined,
      deleteFile: this.props.onDeleteFile ? this.deleteFile : undefined,
      deleteFolder: this.props.onDeleteFolder ? this.deleteFolder : undefined,

      getItemProps: getItemProps,
    };
  }

  renderActionBar(selectedItems) {
    const {
      icons,
      canFilter,
      filterRendererProps,
      filterRenderer: FilterRenderer,
      actionRenderer: ActionRenderer,
      onCreateFolder,
      onRenameFile,
      onRenameFolder,
      onDeleteFile,
      onDeleteFolder,
      onDownloadFile,
    } = this.props;
    const browserProps = this.getBrowserProps();
    const selectionIsFolder =
      selectedItems.length === 1 && !selectedItems[0].size;
    let filter;
    if (canFilter) {
      filter = (
        <FilterRenderer
          value={this.state.nameFilter}
          icons={this.props.icons}
          updateFilter={this.updateFilter}
          {...filterRendererProps}
        />
      );
    }

    const actions = (
      <ActionRenderer
        browserProps={browserProps}
        selectedItems={selectedItems}
        isFolder={selectionIsFolder}
        icons={icons}
        nameFilter={this.state.nameFilter}
        canCreateFolder={typeof onCreateFolder === "function"}
        onCreateFolder={this.handleActionBarAddFolderClick}
        canRenameFile={typeof onRenameFile === "function"}
        onRenameFile={this.handleActionBarRenameClick}
        canRenameFolder={typeof onRenameFolder === "function"}
        onRenameFolder={this.handleActionBarRenameClick}
        canDeleteFile={typeof onDeleteFile === "function"}
        onDeleteFile={this.handleActionBarDeleteClick}
        canDeleteFolder={typeof onDeleteFolder === "function"}
        onDeleteFolder={this.handleActionBarDeleteClick}
        canDownloadFile={typeof onDownloadFile === "function"}
        onDownloadFile={this.handleActionBarDownloadClick}
      />
    );

    return (
      <div className="action-bar" ref={this.actionBarRef}>
        {filter}
        {actions}
      </div>
    );
  }

  renderFiles(files, depth) {
    const {
      fileRenderer: FileRenderer,
      fileRendererProps,
      folderRenderer: FolderRenderer,
      folderRendererProps,
    } = this.props;
    const browserProps = this.getBrowserProps();
    let renderedFiles = [];

    files.map((file) => {
      const thisItemProps = {
        ...browserProps.getItemProps(file, browserProps),
        depth: this.state.nameFilter ? 0 : depth,
      };

      if (!isFolder(file)) {
        renderedFiles.push(
          <FileRenderer
            {...file}
            {...thisItemProps}
            browserProps={browserProps}
            isShouldShowShared={this.isShouldShowShared()}
            isShouldShowSharedWithWhom={this.isShouldShowSharedWithWhom()}
            {...fileRendererProps}
          />
        );
      } else {
        if (this.props.showFoldersOnFilter || !this.state.nameFilter) {
          renderedFiles.push(
            <FolderRenderer
              {...file}
              {...thisItemProps}
              isShouldShowShared={this.isShouldShowShared()}
              isShouldShowSharedWithWhom={this.isShouldShowSharedWithWhom()}
              browserProps={browserProps}
              {...folderRendererProps}
            />
          );
        }
        if (
          this.state.nameFilter ||
          (thisItemProps.isOpen && !browserProps.nestChildren)
        ) {
          renderedFiles = renderedFiles.concat(
            this.renderFiles(file.children, depth + 1)
          );
        }
      }
    });
    return renderedFiles;
  }
  // Not using this
  handleMultipleDeleteSubmit = () => {
    console.log(this);
    this.deleteFolder(
      this.state.selection.filter(
        (selection) => selection[selection.length - 1] === "/"
      )
    );
    this.deleteFile(
      this.state.selection.filter(
        (selection) => selection[selection.length - 1] !== "/"
      )
    );
  };

  render() {
    const { selection } = this.state;

    const browserProps = this.getBrowserProps();
    const headerProps = {
      browserProps,
      fileKey: "",
      fileCount: this.props.files.length,
      isShouldShowShared: this.isShouldShowShared(),
      isShouldShowSharedWithWhom: this.isShouldShowSharedWithWhom(),
    };
    let renderedFiles;

    let files = this.props.files.concat([]);
    if (this.state.activeAction === "createFolder") {
      files.push({
        key: this.state.actionTargets[0],
        size: 0,
        draft: true,
      });
    }
    if (this.state.nameFilter) {
      const filteredFiles = [];
      const terms = this.state.nameFilter.toLowerCase().split(" ");
      files.map((file) => {
        let skip = false;
        terms.map((term) => {
          if (file.key.toLowerCase().trim().indexOf(term) === -1) {
            skip = true;
          }
        });
        if (skip) {
          return;
        }
        filteredFiles.push(file);
      });
      files = filteredFiles;
    }
    if (typeof this.props.group === "function") {
      files = this.props.group(files, "");
    } else {
      const newFiles = [];
      files.map((file) => {
        if (!isFolder(file)) {
          newFiles.push(file);
        }
      });
      files = newFiles;
    }
    const selectedItems = [];
    const findSelected = (item) => {
      if (selection.includes(item.key)) {
        selectedItems.push(item);
      }
      if (item.children) {
        item.children.map(findSelected);
      }
    };
    files.map(findSelected);
    if (typeof this.props.sort === "function") {
      files = this.props.sort(files);
    }

    let header;
    /** @type any */
    let contents = this.renderFiles(files, 0);
    switch (this.props.renderStyle) {
      case "table":
        if (!contents.length) {
          if (this.state.nameFilter) {
            contents = (
              <tr>
                <td colSpan={100}>
                  No files matching "{this.state.nameFilter}".
                </td>
              </tr>
            );
          } else {
            contents = (
              <tr>
                <td colSpan={100}>{this.props.noFilesMessage}</td>
              </tr>
            );
          }
        } else {
          if (this.state.nameFilter) {
            const numFiles = contents.length;
            contents = contents.slice(0, this.state.searchResultsShown);
            if (numFiles > contents.length) {
              contents.push(
                <tr key="show-more">
                  <td colSpan={100}>
                    <a onClick={this.handleShowMoreClick} href="#">
                      Show more results
                    </a>
                  </td>
                </tr>
              );
            }
          }
        }

        if (this.props.headerRenderer) {
          header = (
            <thead>
              <this.props.headerRenderer
                {...headerProps}
                {...this.props.headerRendererProps}
              />
            </thead>
          );
        }

        renderedFiles = (
          <table cellSpacing="0" cellPadding="0">
            {header}
            <tbody>{contents}</tbody>
          </table>
        );
        break;

      case "list":
        if (!contents.length) {
          if (this.state.nameFilter) {
            contents = (
              <p className="empty">
                No files matching "{this.state.nameFilter}"
              </p>
            );
          } else {
            contents = <p className="empty">No files.</p>;
          }
        } else {
          let more;
          if (this.state.nameFilter) {
            const numFiles = contents.length;
            contents = contents.slice(0, this.state.searchResultsShown);
            if (numFiles > contents.length) {
              more = (
                <a onClick={this.handleShowMoreClick} href="#">
                  Show more results
                </a>
              );
            }
          }
          contents = (
            <div>
              <ul>{contents}</ul>
              {more}
            </div>
          );
        }

        if (this.props.headerRenderer) {
          header = (
            <this.props.headerRenderer
              {...headerProps}
              {...this.props.headerRendererProps}
            />
          );
        }

        renderedFiles = (
          <div>
            {header}
            {contents}
          </div>
        );
        break;
    }

    const ConfirmMultipleDeletionRenderer = this.props
      .confirmMultipleDeletionRenderer;

    return (
      <div className="rendered-react-keyed-file-browser">
        {this.props.actions}
        <div
          className="rendered-file-browser"
          ref={(el) => {
            this.browserRef = el;
          }}
        >
          {this.props.showActionBar && this.renderActionBar(selectedItems)}
          {this.state.activeAction === "delete" &&
            this.state.selection.length > 1 && (
              <ConfirmMultipleDeletionRenderer
                handleDeleteSubmit={this.handleMultipleDeleteSubmit}
              />
            )}
          <div className="files">{renderedFiles}</div>
        </div>
        {this.state.previewFile !== null && (
          <this.props.detailRenderer
            file={this.state.previewFile}
            close={this.closeDetail}
            {...this.props.detailRendererProps}
          />
        )}
      </div>
    );
  }
}

@DragDropContext(HTML5Backend)
class FileBrowser extends RawFileBrowser {}

export default FileBrowser;
export { RawFileBrowser };
