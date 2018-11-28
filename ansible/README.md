## ansible

`playbooks/inithetzner.yml` is the initial setup for Hetzner
servers. It's useful to have different initialization playbooks for
different hosting providers.  If we continue with Digital Ocean we
will have `playbooks/initdigitalocean.yml`.



## examples of running ansible

### checking behaviour of --limit
```
ansible-playbook playbooks/hetznerinit.yml --limit staging --list-hosts
```

### running ansible on all server in "--check" mode, not changing things

```
ansible-playbook --check playbooks/hetznerinit.yml
```

### running ansible on only dev server
```
ansible-playbook playbooks/hetznerinit.yml --limit dev
```

### running ansible on dev and staging
```
ansible-playbook playbooks/hetznerinit.yml --limit non-prod
```

### deploy specific version. branch can be the full 40-character SHA-1 hash, the literal string HEAD, a branch name, or a tag name.
```
ansible-playbook playbooks/trustroots.yml --limit dev --extra-vars "version=any_branch"
```

### limit roles with --tag paramter
```
ansible-playbook playbooks/trustroots.yml --tags nginx --extra-vars "version=any_branch"
```