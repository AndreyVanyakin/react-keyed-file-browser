import React from "react";
import ClassNames from "classnames";
import { DragSource, DropTarget } from "react-dnd";
import { NativeTypes } from "react-dnd-html5-backend";

import BaseFolder, { BaseFolderConnectors } from "./../base-folder.js";
import { BaseFileConnectors } from "./../base-file.js";

class RawTableFolder extends BaseFolder {
  render() {
    const {
      isOpen,
      isDragging,
      isDeleting,
      isRenaming,
      isDraft,
      isOver,
      isSelected,
      action,
      url,
      isShouldShowShared,
      browserProps,
      connectDragPreview,
      depth,
    } = this.props;

    const icon = browserProps.icons[isOpen ? "FolderOpen" : "Folder"];
    const inAction = isDragging || action;

    const ConfirmDeletionRenderer = browserProps.confirmDeletionRenderer;

    let name;
    if (!inAction && isDeleting && browserProps.selection.length === 1) {
      name = (
        <ConfirmDeletionRenderer
          handleDeleteSubmit={this.handleDeleteSubmit}
          handleFileClick={this.handleFileClick}
          url={url}
        >
          {icon}
          {this.getName()}
        </ConfirmDeletionRenderer>
      );
    } else if ((!inAction && isRenaming) || isDraft) {
      name = (
        <div>
          <form className="renaming" onSubmit={this.handleRenameSubmit}>
            {icon}
            <input
              type="text"
              ref={(el) => {
                this.newNameRef = el;
              }}
              value={this.state.newName}
              onChange={this.handleNewNameChange}
              onBlur={this.handleCancelEdit}
              autoFocus
            />
          </form>
        </div>
      );
    } else {
      name = (
        <div>
          <a onClick={this.toggleFolder}>
            {icon}
            {this.getName()}
          </a>
        </div>
      );
    }

    let draggable = <div>{name}</div>;
    if (typeof browserProps.moveFile === "function") {
      draggable = connectDragPreview(draggable);
    }

    const folder = (
      <tr
        className={ClassNames("folder", {
          pending: action,
          dragging: isDragging,
          dragover: isOver,
          selected: isSelected,
        })}
        onClick={this.handleFolderClick}
        onDoubleClick={this.handleFolderDoubleClick}
      >
        <td className="name">
          <span className="checkbox-icon">
            {isSelected
              ? browserProps.icons.Checked
              : browserProps.icons.Unchecked}
          </span>
          <div style={{ paddingLeft: depth * 16 + "px" }}>{draggable}</div>
        </td>
        {this.props.isShouldShowShared ? <td /> : null}
        <td />
        <td />
        <td />
      </tr>
    );

    return this.connectDND(folder);
  }
}

@DragSource(
  "folder",
  BaseFolderConnectors.dragSource,
  BaseFolderConnectors.dragCollect
)
@DropTarget(
  ["file", "folder", NativeTypes.FILE],
  BaseFileConnectors.targetSource,
  BaseFileConnectors.targetCollect
)
class TableFolder extends RawTableFolder {}

export default TableFolder;
export { RawTableFolder };
