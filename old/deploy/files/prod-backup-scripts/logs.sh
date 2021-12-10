# Backup logging to files instead of stdout
#
# Include this to bash file:
# source logs.sh
#

# Close STDOUT file descriptor
exec 1<&-
# Close STDERR FD
exec 2<&-

# Ensure log folder exists
if [ ! -d "$LOGSPATH" ]; then
  echo "Creating $LOGSPATH directory..."
  mkdir -p $LOGSPATH
fi

# Open STDOUT as $LOG_FILE file for read and write.
exec 1<>$LOGFILE

# Redirect STDERR to STDOUT
exec 2>&1

# Delete older logfiles
echo "Delete old logs..."
find $LOGSPATH -name "*.log" -type f -mtime +5 -print -delete
