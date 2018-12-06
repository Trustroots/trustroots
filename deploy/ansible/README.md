## Setting up a new Hetzner cloud instance
0. Make sure to add your ssh key to the box
1. If not present, add `box` to `ansible/hosts`

# ansible

## examples of running ansible

### First runn
```
ansible-playbook playbooks/dev/tr.yml  -e "ansible_ssh_user=admin"
```

### checking behaviour of --limit
```
ansible-playbook playbooks/dev/tr.yml --limit staging --list-hosts
```

### running ansible on all server in "--check" mode, not changing things
```
ansible-playbook --check playbooks/dev/tr.yml
```

### running ansible on only dev server
```
ansible-playbook playbooks/dev/tr.yml --limit dev
```

### running ansible on dev and staging
```
# TODO: make this possible again
#ansible-playbook playbooks/dev/tr.yml --limit non-prod
```

### deploy specific branch
```
# 'branch' can be the full 40-character SHA-1 hash, the literal string HEAD, a branch name, or a tag name.
ansible-playbook playbooks/dev/tr.yml --limit dev --extra-vars "version=any_branch"
```

### limit roles with --tag paramter
```
ansible-playbook playbooks/dev/tr.yml --tags nginx --extra-vars "version=other_branch"
```
