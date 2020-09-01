// subroutine to attach event handler functions to html elements
function addEvents() {
	$loginForm.$login.onclick = function(e) {
		e.preventDefault()
		$loginError.textContent = "logging in..."
		me.logOut()
		me.logIn($loginForm.$username.value, $loginForm.$password.value, function(e, resp){
			if (!e) {
				$loginError.textContent = ""
			} else if (e == 'error' && resp) {
				var errors = ["Login failed:"]
				if (resp.errors) {
					for (var key in resp.errors) {
						errors.push(resp.errors[key].join(" "))
					}
				} else
					errors.push(resp)
				$loginError.textContent = errors.join("\n").replace(" or email", "")//sorry
			}
		})
	}

	$logout.onclick = function(e) {
		me.logOut()
		e.preventDefault()
	}
	
	$editorTextarea.oninput = function() {
		updateEditorPreview(true)
	}
	$markupSelect.onchange = function() {
		updateEditorPreview(true)
	}
	$markupUpdate.onclick = function() {
		updateEditorPreview(false)
	}

	$submitEdit.onclick = submitEdit
	$cateditSubmit.onclick = cateditSubmit
	$deletePage.onclick = deletePage
	
	$registerForm.$registerButton.onclick = function(e) {
		e.preventDefault()
		$registerError.textContent = " "
		if ($registerForm.email.value != $registerForm.email2.value) {
			$registerError.textContent = "Emails don't match"
			return
		}
		if ($registerForm.password.value != $registerForm.password2.value) {
			$registerError.textContent = "Passwords don't match"
			return
		}
		var email = $registerForm.email.value
		me.register($registerForm.username.value, $registerForm.password.value, email, function(e, resp) {
			if (e == 'error' && resp) {
				var errors = ["Registration failed:"]
				if (resp.errors) {
					for (var key in resp.errors) {
						errors.push(resp.errors[key].join(" "))
					}
				} else
					errors.push(resp)
				$registerError.textContent = errors.join("\n")
			} else if (!e) {
				sendConfirmationEmail()
			}
		})
	}
	function sendConfirmationEmail() {
		var email = $registerForm.email.value
		if (!email) {
			$registerError.textContent = "No email"
		} else {
			$registerError.textContent = "Sending email..."
			me.sendEmail(email, function(e, resp){
				if (!e) {
					$registerError.textContent = "Confirmation email sent"
				} else {
					$registerError.textContent = "Error sending confirmation email:\n"+resp
				}
			})
		}
	}
	$resendEmail.onclick = function(e) {
		e.preventDefault()
		sendConfirmationEmail()
	}
	$registerConfirm.onclick = function(e) {
		e.preventDefault()
		$registerError.textContent = "Confirming..."
		// todo: validate the key client-side maybe
		me.confirmRegister($emailCode.value, function(e, resp) {
			if (!e) {
				$registerError.textContent = "Registration Complete"
				window.location.hash = "#user/"+me.uid
			} else {
				$registerError.textContent = "Failed to confirm registration:\n"+resp
			}
		})
	}
		$openSidebar.onclick = $closeSidebar.onclick = toggleSidebar
	
	$setAvatarButton.onclick = function() {
		if (selectedFile && selectedFile.id) {
			me.setBasic({avatar: selectedFile.id}, function(e) {
				if (!e) {
					/*updateAvatar(selectedFile)*/
					/*lp.updateAvatar()*/
				}
			})
		}
	}

	$fileUploadButton.onclick = function() {
		if (selectedFile instanceof File || selectedFile instanceof Blob) {
			me.uploadFile(selectedFile, function(e, resp) {
				if (!e) {
					$fileBox.insertBefore(renderFileThumbnail(resp),$fileBox.firstChild)
					selectFile(resp)
				}
			})
		}
	}
	
	$fileUpload.onchange = function(e) {
		var file = this.files[0]
		if (file) {
			selectUploadedFile(file)
		}
	}

	attachPaste($filePaste, function(url) {
		selectFileURL(url)
	})
	
	$fileUpdateButton.onclick = function() {
		if (selectedFile && selectedFile.id) {
			readFileFields(selectedFile)
			me.putFile(selectedFile, function(e, resp) {
			})
		}
	}

	$submitUserSettings.onclick = submitUserSettings

	$testButton.onclick = function() {
		var c = $testTextarea.value
		$testOut.textContent="Starting..."
		try {
			var res = eval(c)
			$testOut.textContent="Finished:\n"+res
		} catch(e) {
			$testOut.textContent="Error:\n"+res
		}
	}

	$saveUserCSS.onclick = function() {
		var css = $settingsUserCSS.value
		localStorage.userCSS = css
		me.setVariable("userCSS", css, function(){})
		setUserCSS(css)
	}

	$saveUserJS.onclick = function() {
		var css = $settingsUserJS.value
		localStorage.userJS = css
		me.setVariable("userJS", css, function(){})
		setUserJS(css)
	}
	attachResize($sidebar, $sidebarPinnedResize, true, -1, "sidebarWidth")
	attachResize($sidebarPinned, $sidebarPinnedResize, false, 1, "sidebarPinnedHeight")
	
	document.addEventListener('videoclicked', function(e) {
		imageFocusClickHandler(e.target)
	})
	document.onmousedown = function(e) {
		if (!e.button) // 0 or none (prevent right click etc.)
			imageFocusClickHandler(e.target)
	}
	var embiggenedImage
	function imageFocusClickHandler(element) {
		if (element.hasAttribute('shrink')) {
			// if click on image that's already big:
			if (embiggenedImage && embiggenedImage == element) {
				embiggenedImage.removeAttribute('bigImage')
				embiggenedImage = null
			} else if (element != embiggenedImage) { // if click on new iamge
				if (embiggenedImage)
					embiggenedImage.removeAttribute('bigImage')
				element.setAttribute('bigImage', "")
				embiggenedImage = element
			}
		} else if (!(element instanceof HTMLTextAreaElement)) {
			if (embiggenedImage && element != embiggenedImage) {
				embiggenedImage.removeAttribute('bigImage')
				embiggenedImage = null
			}
		}
	}
	
	document.onclick = function(e) {
		var element = e.target
		if (flags.editComment || flags.deleteComment) {
			while (element && element instanceof HTMLElement) {
				var id = element.getAttribute('data-id')
				if (id) {
					if (flags.editComment) {
						editComment(+id, element)
						break
					} else {
						deleteComment(+id, element)
						break
					}
				}
				element = element.parentNode
			}
			flag('editComment')
			flag('deleteComment')
		}
	}
	
	/*$sidebar.onclick = function(e) {
		if (e.target == $sidebarPinnedResize)
			return
		if (isFullscreenSidebar() && flags.mobileSidebar) {
			toggleSidebar()
		}
	}*/

	$permissionAddButton.onclick = function() {
		var uid = +$permissionUserInput.value
		if (!uid || uid == editingPage.createUserId || $permissionBox.querySelector('tr[data-uid="'+uid+'"]')) {
			return
		}
		me.getUser(uid, function(resp) {
			if (resp) {
				$permissionBox.appendChild(renderPermissionLine(resp, "cr"))
			}
		})
	}
	
	var voteBtns = [$voteButton_b, $voteButton_o, $voteButton_g]
	var voteCounts = [$voteCount_b, $voteCount_o, $voteCount_g]
	// todo: update counts when changing
	var voteBlock
	voteBtns.forEach(function(button, buttoni) {
		button.onclick = function(e) {
			if (voteBlock || !me.auth)
				return
			var selected = button.getAttribute('data-selected')
			var vote = !selected ? button.getAttribute('data-vote') : null
			voteBlock = true
			me.setVote(currentPage, vote, function(e, resp){
				voteBlock = false
				if (!e) {
					voteBtns.forEach(function(btn, i) {
						if (btn != button || selected) {
							if (btn.getAttribute('data-selected') != null) {
								voteCounts[i].textContent = +voteCounts[i].textContent - 1
							}
							btn.removeAttribute('data-selected')
						}
					})
					//todo: update vote counts here
					if (!selected) {
						button.setAttribute('data-selected', "true")
						voteCounts[buttoni].textContent = +voteCounts[buttoni].textContent + 1
						//increment
					}
				}
			})
		}
	})
	var blockWatch
	$watchCheck.onchange = function() {
		if (blockWatch)
			return
		blockWatch = true
		me.setWatch(currentPage, $watchCheck.checked, function(){
			blockWatch = false
		})
	}
	
	$chatSend.onclick = function() {
		if ($chatTextarea.value && currentChatRoom) {
			if (editingMessage) {
				sendMessage(currentChatRoom, $chatTextarea.value, {m:$chatMarkupSelect.value}, editingMessage)
				cancelEdit()
			} else {
			    var meta = {m:$chatMarkupSelect.value}
			    if (me && me.me)
				meta.a = me.me.avatar
				sendMessage(currentChatRoom, $chatTextarea.value, meta)
			}
			$chatTextarea.value = ""
		}
	}
	$chatTextarea.onkeypress = function(e) {
		if (!e.shiftKey && e.keyCode == 13) {
			$chatSend.onclick()
			e.preventDefault()
		}
	}
	
	$chatDelete.onclick = function() {
		cancelEdit()
		window.setTimeout(function() {
			flag('deleteComment', true)
			focusLastComment()
		}, 10)
	}
	$chatEdit.onclick = function() {
		cancelEdit()
		window.setTimeout(function() {
			flag('editComment', true)
			focusLastComment()
		}, 10)
	}
	$cancelEdit.onclick = function() {
		cancelEdit()
		$chatTextarea.focus()
	}
	document.addEventListener('keydown', function(e) {
		if (e.keyCode == 32 || e.keyCode == 13) {
			var active = document.activeElement
			if (active && active.getAttribute('data-id')) {
				active.click()
				e.preventDefault()
			}
		}
		if (e.keyCode == 27) {
			cancelEdit()
			flag('editComment')
			flag('deleteComment')
		}
	})

	$searchButton.onclick = function() {
		me.search($searchInput.value, 0, function(user, content) {
			if (!user)
				return
			generateSearchResults(user, content)
		})
	}
	
	$searchChatButton.onclick = function() {
		var search = "%\n%"+$searchInput.value+"%"
		me.searchChat(search, 0, function(messages, users) {
			if (!messages)
				return
			generateChatSearchResults(messages, users)
		})
	}
	
	var hideLock1
	$hideGlobalStatusButton.onclick = function() {
		if (hideLock1)
			return
		hideLock1 = true
		me.toggleHiding(-1, function() {
			hideLock1 = false
		})
	}
	/*var hideLock2
	$hideAllStatusButton.onclick = function() {
		if (hideLock2)
			return
		hideLock2 = true
		me.toggleHiding(0, function() {
			hideLock2 = false
		})
	}*/
}
