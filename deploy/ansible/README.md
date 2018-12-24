## Setting up a new Hetzner cloud instance
0. Make sure to add your ssh key to the box
1. If not present, add `box` to `ansible/hosts`

# ansible

## examples of running ansible

### First runn
```
ansible-playbook playbooks/dev/tr.yml  -e "ansible_ssh_user=root"
```

### checking behaviour of --limit
```
ansible-playbook playbooks/dev/tr.yml --limit staging --list-hosts
```

### running ansible on all server in "--check" mode, not changing things
```
ansible-playbook --check playbooks/dev/tr.yml
```

### deploy specific branch
```
# 'branch' can be the full 40-character SHA-1 hash, the literal string HEAD, a branch name, or a tag name.
ansible-playbook playbooks/dev/tr.yml --extra-vars "version=any_branch"
```

### limit roles with --tag paramter
```
ansible-playbook playbooks/dev/tr.yml --tags nginx --extra-vars "version=other_branch"
```

# ansible-vault

## configure anisble vault

0. Ask guaka for ansible-vault password
1. put vault password where ansible is configured to look for it
3. if needed, configure the env var $EDITOR (export or shell rc)

```
md5sum ~/.vault/trustroots-vault-pass.ansible
b64d326e03c3c717941ef3200c7a41ca
```

## usage / test

### decrypt to stdout
```
cd  repos/trustroots/deploy/ansible
ansible-vault decrypt  ../files/secrets/dev.trustroots.org.local.js --output=-
```

### edit
```
ansible-vault edit  ../files/secrets/dev.trustroots.org.local.js
```
