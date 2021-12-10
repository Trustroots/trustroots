#!/bin/sh
# Cleanup docker files: untagged containers and images.
#
# https://github.com/blueyed/dotfiles/blob/master/usr/bin/docker-cleanup
#
# Use `cleanup -n` for a dry run to see what would be deleted.

untagged_containers() {
	# Print containers using untagged images: $1 is used with awk's print: 0=line, 1=column 1.
	# NOTE: "[0-9a-f]{12}" does not work with GNU Awk 3.1.7 (RHEL6).
	#       Ref: https://github.com/blueyed/dotfiles/commit/a14f0b4b#commitcomment-6736470
	docker ps -a | tail -n +2 | awk '$2 ~ "^[0-9a-f]+$" {print $'$1'}'
}

untagged_images() {
	# Print untagged images: $1 is used with awk's print: 0=line, 3=column 3.
	# NOTE: intermediate images (via -a) seem to only cause
	# "Error: Conflict, foobarid wasn't deleted" messages.
	# Might be useful sometimes when Docker messed things up?!
	# docker images -a | awk '$1 == "<none>" {print $'$1'}'
	docker images | tail -n +2 | awk '$1 == "<none>" {print $'$1'}'
}

# Dry-run.
if [ "$1" = "-n" ]; then
	echo "=== Containers with uncommitted images: ==="
	untagged_containers 0
	echo

	echo "=== Uncommitted images: ==="
	untagged_images 0

	exit
fi
if [ -n "$1" ]; then
	echo "Cleanup docker files: remove untagged containers and images."
	echo "Usage: ${0##*/} [-n]"
	echo "   -n: dry run: display what would get removed."
	exit 1
fi

# Remove containers with untagged images.
echo "Removing containers:" >&2
untagged_containers 1 | xargs --no-run-if-empty docker rm --volumes=true

# Remove untagged images
echo "Removing images:" >&2
untagged_images 3 | xargs --no-run-if-empty docker rmi

exit 0
